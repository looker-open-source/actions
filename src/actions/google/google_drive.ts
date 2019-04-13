import * as https from "request-promise-native"
import * as winston from "winston"
import * as Hub from "../../hub"

const streamifier: any = require("streamifier")
const { google } = require("googleapis")
const ROOT_FOLDER_NAME = "My Drive"

interface FolderOption {
  name: string,
  id: string
}

export class GoogleDriveAction extends Hub.OAuthAction {

  name = "google_drive"
  label = "Google Drive"
  iconName = "google/google_drive.svg"
  description = "Send information from Looker directly to a Google Drive folder"
  supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
  usesStreaming = false
  requiredFields = []
  params = []
  googleAuth = new google.auth.OAuth2(
    process.env.GOOGLE_DRIVE_CLIENT_ID,
    process.env.GOOGLE_DRIVE_CLIENT_SECRET,
  )

  async execute(request: Hub.ActionRequest) {
    const filename = request.formParams.filename || request.suggestedFilename()
    if (!filename) {
      throw new Error("Couldn't determine filename.")
    }

    if (!request.attachment || !request.attachment.dataBuffer) {
      throw new Error("Couldn't get data from attachment")
    }

    let accessToken = ""
    if (request.params.state_json) {
      const stateJson = JSON.parse(request.params.state_json)
      if (stateJson.code && stateJson.redirect) {
        accessToken = await this.getAccessTokenFromCode(stateJson)
      }
    }
    const drive = this.getClientFromRequest(request, accessToken)

    const fileMetadata = {
      name: filename,
      parents: new Array(),
      mimeType: request.attachment.mime,
    }

    if (request.formParams.folder) {
      fileMetadata.parents.push(request.formParams.folder)
    }
    try {
      await drive.files.create(
        {
          resource: fileMetadata,
          media: {
            body: streamifier.createReadStream(request.attachment.dataBuffer),
          },
        },
      )
      const resp = new Hub.ActionResponse({ success: true })
      resp.state = new Hub.ActionState()
      resp.state.data = JSON.stringify({tokens: this.googleAuth.credentials})
      return resp
    } catch (e) {
      const resp = new Hub.ActionResponse({ success: false })
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
      return resp
    }
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    let accessToken = ""
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.code && stateJson.redirect) {
          accessToken = await this.getAccessTokenFromCode(stateJson)
        }
      } catch { winston.warn("Could not parse state_json") }
    }
    const drive = this.getClientFromRequest(request, accessToken)

    const params = {
      q: "mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false",
      fields: "files(id, name, parents)",
      orderBy: "name",
      pageSize: 1000,
    }

    try {
      const results = await drive.files.list(params)
      const folders: FolderOption[] = this.generateFolderOptions(results.data.files)

      form.fields = [{
        label: "Folder",
        name: "folder",
        required: false,
        options: folders.map((f: any) => {
          return { name: f.id, label: f.name }
        }),
        type: "select",
      }, {
          label: "Enter a name",
          name: "filename",
          type: "string",
        }]

      if (accessToken !== "") {
        const newState = JSON.stringify({ tokens: this.googleAuth.credentials })
        form.state = new Hub.ActionState()
        form.state.data = newState
      }

      return form

    } catch (_error) {
      const actionCrypto = new Hub.ActionCrypto()
      const jsonString = JSON.stringify({ stateurl: request.params.state_url })
      const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err: string) => {
        winston.error("Encryption not correctly configured")
        throw err
      })
      form.state = new Hub.ActionState()
      form.fields.push({
        name: "login",
        type: "oauth_link",
        label: "Log in with Google",
        oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_drive/oauth?state=${ciphertextBlob}`,
      })
      return (form)
    }
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    // Generate the url that will be used for the consent dialog.

    return this.updateGoogleAuth(redirectUri).generateAuthUrl({
      access_type: "offline",
      scope: "https://www.googleapis.com/auth/drive",
      state: encryptedState,
    })
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })

    const payload = JSON.parse(plaintext)
    await https.post({
      url: payload.stateurl,
      body: JSON.stringify({code: urlParams.code, redirect: redirectUri}),
    }).catch((_err) => { winston.error(_err.toString()) })
  }

  async oauthCheck(request: Hub.ActionRequest) {
    const drive = this.getClientFromRequest(request, "")
    const params = {
      q: "mimeType='application/vnd.google-apps.folder'",
    }

    try {
      await drive.files.list(params)
      return true
    } catch (err) {
      winston.error(`oauth check failed ${err.message}`)
      return false
    }
  }

  protected async getAccessTokenFromCode(stateJson: any) {
    let result
    if (stateJson.code && stateJson.redirect) {
      try {
        result = await this.updateGoogleAuth(stateJson.redirect).getToken(stateJson.code)
      } catch (_err) {
        winston.error(`Error requesting access_token: ${_err.toString()}`)
      }
    }
    if (result.tokens) {
      return result.tokens
    } else {
      winston.error("Invalid tokens")
    }
  }

  private updateGoogleAuth(redirectUri: any) {
    if (redirectUri) {
      this.googleAuth.redirectUri = redirectUri
    }
    return this.googleAuth
  }

  private getClientFromRequest(request: Hub.ActionRequest, tokens: string) {
    if (request.params.state_json && tokens === "") {
      try {
        const json = JSON.parse(request.params.state_json)
        tokens = json.tokens
      } catch (er) {
        winston.error("cannot parse")
      }
    }

    this.googleAuth.setCredentials(tokens)

    return google.drive({
      version: "v3",
      auth: this.googleAuth,
    })
  }

  private generateFolderOptions(folders: any[]): FolderOption[] {
    const folderOptions = folders.map((folder) => ({name: `${ROOT_FOLDER_NAME} / ${folder.name}`, id: folder.id}))

    return [{ name: ROOT_FOLDER_NAME, id: "" }, ...folderOptions]
  }
}

Hub.addAction(new GoogleDriveAction())
