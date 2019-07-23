import * as https from "request-promise-native"

import { GaxiosResponse } from "gaxios"
import { Credentials } from "google-auth-library"
import { drive_v3, google } from "googleapis"

import * as winston from "winston"
import * as Hub from "../../../hub"

export class GoogleDriveAction extends Hub.OAuthAction {
    name = "google_drive"
    label = "Google Oauth"
    iconName = "google/drive/google.svg"
    oauthIconName = "google/drive/google_signin.png"
    description = "Oauth to Google to do more cool things with Looker"
    supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
    usesStreaming = true
    minimumSupportedLookerVersion = "6.8.0"
    requiredFields = []
    params = []
    mimeType: string | undefined = undefined

  async execute(request: Hub.ActionRequest) {
    const resp = new Hub.ActionResponse()

    if (!request.params.state_json) {
      resp.success = false
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
      return resp
    }

    const stateJson = JSON.parse(request.params.state_json)
    if (stateJson.tokens && stateJson.redirect) {
      const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens)

      const filename = request.formParams.filename || request.suggestedFilename()

      const fileMetadata: drive_v3.Schema$File = {
        name: filename,
        mimeType: this.mimeType,
        parents: request.formParams.folder ? [request.formParams.folder] : undefined,
      }
      try {
        await request.stream(async (readable) => {
          return drive.files.create({
            requestBody: fileMetadata,
            media: {
              body: readable,
            },
          })
        })
        resp.success = true
      } catch (e) {
        resp.success = false
        resp.message = e.message
      }
    } else {
      resp.success = false
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
    }
    return resp
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = []

    const actionCrypto = new Hub.ActionCrypto()
    const jsonString = JSON.stringify({stateurl: request.params.state_url})
    const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err: string) => {
      winston.error("Encryption not correctly configured")
      throw err
    })
    form.state = new Hub.ActionState()
    form.fields.push({
      name: "login",
      type: "oauth_link",
      label: "Log in",
      description: "In order to send to Google Drive, you will need to log in" +
        " once to your Google account.",
      oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`,
    })

    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.tokens && stateJson.redirect) {
          form.fields.push({
            name: "loggedInUser",
            label: "Logged In As",
            type: "auth_info",
            value: stateJson.tokens.email,
          })
          const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens)

          const options: any = {
            fields: "files(id,name,parents),nextPageToken",
            orderBy: "recency desc",
            pageSize: 1000,
            q: "mimeType='application/vnd.google-apps.folder'",
            spaces: "drive",
          }

          async function pagedFileList(
            accumulatedFiles: drive_v3.Schema$File[],
            response: GaxiosResponse<drive_v3.Schema$FileList>): Promise<drive_v3.Schema$File[]> {
            const mergedFiles = accumulatedFiles.concat(response.data.files!)

            // When a `nextPageToken` exists, recursively call this function to get the next page.
            if (response.data.nextPageToken) {
              const pageOptions = { ...options }
              pageOptions.pageToken = response.data.nextPageToken
              return pagedFileList(mergedFiles, await drive.files.list(pageOptions))
            }
            return mergedFiles
          }
          const paginatedFiles = await pagedFileList([], await drive.files.list(options))
          const folders = paginatedFiles.filter((folder) => (
            !(folder.id === undefined) && !(folder.name === undefined)))
            .map((folder) => ({name: folder.id!, label: folder.name!}))
          form.fields = [{
            description: "Google Drive folder where your file will be saved",
            label: "Select folder to save file",
            name: "folder",
            options: folders,
            required: true,
            type: "select",
          }, {
            label: "Enter a name",
            name: "filename",
            type: "string",
            required: true,
          }]
          form.state = new Hub.ActionState()
          form.state.data = JSON.stringify({tokens: stateJson.tokens, redirect: stateJson.redirect})
          return form
        }
      } catch { winston.warn("Log in fail") }
    }
    return form
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    const oauth2Client = this.oauth2Client(redirectUri)

    // generate a url that asks permissions for Google Drive scope
    const scopes = [
      "https://www.googleapis.com/auth/drive",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/script.external_request",
    ]

    const url = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
      state: encryptedState,
    })
    return url.toString()
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })

    const tokens = await this.getAccessTokenCredentialsFromCode(redirectUri, urlParams.code)
    // Pass back context to Looker
    const payload = JSON.parse(plaintext)
    await https.post({
      url: payload.stateurl,
      body: JSON.stringify({tokens, redirect: redirectUri}),
    }).catch((_err) => { winston.error(_err.toString()) })
  }

  async oauthCheck(request: Hub.ActionRequest) {
    if (request.params.state_json) {
      const stateJson = JSON.parse(request.params.state_json)
      if (stateJson.tokens && stateJson.redirect) {
        const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens)
        await drive.files.list({
          pageSize: 10,
        })
        return true
      }
    }
    return false
  }

  protected async getAccessTokenCredentialsFromCode(redirect: string, code: string) {
    const client = this.oauth2Client(redirect)
    const {tokens} = await client.getToken(code)

    if (!tokens || !tokens.access_token) {
      throw new Error("Illegal")
    }

    const info = await client.getTokenInfo(tokens.access_token)

    if (!info) {
      throw new Error("Illegal")
    }

    return Object.assign({}, tokens, info)
  }

  protected async driveClientFromRequest(redirect: string, tokens: Credentials) {
    const client = this.oauth2Client(redirect)
    client.setCredentials(tokens)
    return google.drive({version: "v3", auth: client})
  }

  private oauth2Client(redirectUri: string | undefined) {
    return new google.auth.OAuth2(
      process.env.GOOGLE_DRIVE_CLIENT_ID,
      process.env.GOOGLE_DRIVE_CLIENT_SECRET,
      redirectUri,
    )
  }
}

if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
  Hub.addAction(new GoogleDriveAction())
}
