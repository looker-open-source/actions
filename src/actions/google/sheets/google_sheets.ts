import * as https from "request-promise-native"

import { GaxiosResponse } from "gaxios"
import { Credentials } from "google-auth-library"
import { drive_v3, google } from "googleapis"

import * as winston from "winston"
import * as Hub from "../../../hub"

export class GoogleSheetsAction extends Hub.OAuthAction {
    name = "google_sheets"
    label = "Google Sheets"
    iconName = "google/sheets/sheets.svg"
    description = "Create a new Google Sheet."
    supportedActionTypes = [Hub.ActionType.Query]
    usesStreaming = false
    minimumSupportedLookerVersion = "6.8.0"
    requiredFields = []
    params = []
    supportedFormats = [Hub.ActionFormat.Csv]

  async execute(request: Hub.ActionRequest) {
    const filename = request.formParams.filename || request.suggestedFilename()

    const resp = new Hub.ActionResponse()
    if (!(request.attachment && request.attachment.dataBuffer)) {
      resp.success = false
      resp.message = "No data sent from Looker to be sent to Google Sheets."
      return resp
    }

    if (!request.params.state_json) {
      resp.success = false
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
      return resp
    }

    const stateJson = JSON.parse(request.params.state_json)
    if (stateJson.code && stateJson.redirect) {
      const tokens = await this.getAccessTokenCredentialsFromCode(stateJson)
      const drive = await this.driveClientFromRequest(request, tokens)

      const fileBuf = request.attachment.dataBuffer

      const fileMetadata: drive_v3.Schema$File = {
        name: filename,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: request.formParams.folder ? [request.formParams.folder] : undefined,
      }
      const media = {
        mimeType: "text/csv",
        body: fileBuf,
      }
      try {
        await drive.files.create({
          requestBody: fileMetadata,
          media,
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
      const stateJson = JSON.parse(request.params.state_json)
      if (stateJson.code && stateJson.redirect) {
        try {
          const tokens = await this.getAccessTokenCredentialsFromCode(stateJson)
          const drive = await this.driveClientFromRequest(request, tokens)

          const options: any = {
            pageSize: 1000,
            q: "mimeType='application/vnd.google-apps.folder'",
            fields: "files(id,parents),nextPageToken",
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
            description: "Google Drive folder where file will be saved",
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
          form.state.data = JSON.stringify(tokens)
          return form
        } catch { winston.warn("Log in fail") }
      }
    }
    return form
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_SHEETS_CLIENT_ID,
      process.env.GOOGLE_SHEETS_CLIENT_SECRET,
      redirectUri,
    )

    // generate a url that asks permissions for Google Drive and Sheets scope
    const scopes = [
      "https://www.googleapis.com/auth/drive",
    ]

    const url = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: "offline",
      scope: scopes,
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

    // Pass back context to Looker
    const payload = JSON.parse(plaintext)
    await https.post({
      url: payload.stateurl,
      body: JSON.stringify({code: urlParams.code, redirect: redirectUri}),
    }).catch((_err) => { winston.error(_err.toString()) })
  }

  async oauthCheck(request: Hub.ActionRequest) {
    if (request.params.state_json) {
      const stateJson = JSON.parse(request.params.state_json)
      const tokens = await this.getAccessTokenCredentialsFromCode(stateJson)
      const drive = await this.driveClientFromRequest(request, tokens)
      await drive.files.list({
        pageSize: 10,
      })
      return true
    }
    return false
  }

  protected async getAccessTokenCredentialsFromCode(stateJson: any) {
    if (stateJson.code && stateJson.redirect) {
      const client = this.oauth2Client(stateJson.redirect)
      const {tokens} = await client.getToken(stateJson.code)
      return tokens
    } else {
      throw "state_json does not contain correct members"
    }
  }

  protected async driveClientFromRequest(request: Hub.ActionRequest, tokens: Credentials) {
    const redirect = ""
    if (request.params.state_json && tokens === undefined) {
      const stateJson = JSON.parse(request.params.state_json)
      tokens = await this.getAccessTokenCredentialsFromCode(stateJson)
    }
    const client = this.oauth2Client(redirect)
    client.setCredentials(tokens)
    return google.drive({version: "v3", auth: client})
  }

  private oauth2Client(redirectUri: string) {
    return new google.auth.OAuth2(
      process.env.GOOGLE_SHEETS_CLIENT_ID,
      process.env.GOOGLE_SHEETS_CLIENT_SECRET,
      redirectUri,
    )
  }
}

if (process.env.GOOGLE_SHEETS_CLIENT_ID && process.env.GOOGLE_SHEETS_CLIENT_SECRET) {
  Hub.addAction(new GoogleSheetsAction())
}
