import * as querystring from "querystring"
import * as https from "request-promise-native"
import * as winston from "winston"
import * as Hub from "../../hub"

const boxSDK: any = require("box-node-sdk")
const ROOT_FOLDER_NAME = "All Files"

interface FolderOption {
  name: string,
  id: string
}

export class BoxAction extends Hub.OAuthAction {

  name = "box"
  label = "Box"
  iconName = "box/box.png"
  description = "Write data files to a Box folder."
  supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
  supportedFormats = [
    Hub.ActionFormat.Txt,
    Hub.ActionFormat.Csv,
    Hub.ActionFormat.InlineJson,
    Hub.ActionFormat.Json,
    Hub.ActionFormat.JsonDetail,
    Hub.ActionFormat.JsonDetailLiteStream,
    Hub.ActionFormat.Xlsx,
    Hub.ActionFormat.Html,
    Hub.ActionFormat.WysiwygPdf,
    Hub.ActionFormat.AssembledPdf,
    Hub.ActionFormat.WysiwygPng,
    Hub.ActionFormat.CsvZip,
  ]
  usesStreaming = false
  requiredFields = []
  params = []
  tokenStore = {
    tokens: {},
    read: ((callback: any) => callback(null, this.tokenStore.tokens) ),
    write: (async (tokenInfo: any, callback: any) => {
      this.tokenStore.tokens = tokenInfo
      callback(null, this.tokenStore.tokens)
    }),
    clear: ((callback: any) => {
      this.tokenStore.tokens = {}
      callback(null, this.tokenStore.tokens)
    }),
  }

  async execute(request: Hub.ActionRequest) {
    const filename = request.formParams.filename || request.suggestedFilename()
    if (!filename) {
      throw new Error("Couldn't determine filename.")
    }

    const ext = request.attachment!.fileExtension

    if (!request.attachment || !request.attachment.dataBuffer) {
      throw new Error("Couldn't get data from attachment")
    }

    let tokens = ""
    if (request.params.state_json) {
      const stateJson = JSON.parse(request.params.state_json)
      if (stateJson.code && stateJson.redirect) {
        tokens = await this.getAccessTokenFromCode(stateJson)
      }
    }
    const box = await this.getClientFromRequest(request, tokens)

    let folderId = "0"
    if (request.formParams.folder) {
      folderId = (request.formParams.folder)
    }
    try {
      await box.files.uploadFile(folderId, `${filename}.${ext}`, request.attachment.dataBuffer)
      const resp = new Hub.ActionResponse({ success: true })
      resp.state = new Hub.ActionState()
      resp.state.data = JSON.stringify({ tokens: this.tokenStore.tokens })
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

    let tokens = ""
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.code && stateJson.redirect) {
          tokens = await this.getAccessTokenFromCode(stateJson)
        }
      } catch { winston.warn("Could not parse state_json") }
    }

    try {
      const box = await this.getClientFromRequest(request, tokens)

      const results = await box.folders.getItems(
        "0", {
          offset: 0,
          limit: 1000,
        },
      )
      const folders: FolderOption[] = this.generateFolderOptions(results.entries)

      form.fields = [{
        label: "Folder",
        name: "folder",
        required: false,
        options: folders.map((f: any) => {
          return { name: f.id, label: f.name }
        }),
        type: "select",
      }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }]

      if (tokens !== "") {
        const newState = JSON.stringify({ tokens: this.tokenStore.tokens })
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
        label: "Log in with Box",
        oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/box/oauth?state=${ciphertextBlob}`,
      })
      return (form)
    }
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    // Generate the url that will be used for the consent dialog.

    const payload = {
      response_type: "code",
      client_id: process.env.BOX_CLIENT_ID,
      redirect_uri: redirectUri,
      state: encryptedState,
    }

    const qs = querystring.stringify(payload)
    return `https://account.box.com/api/oauth2/authorize?${qs}`
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
    const box = await this.getClientFromRequest(request, "")

    try {
      await box.folders.getItems(
        "0", {
          offset: 0,
          limit: 1000,
        },
      )
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
        result = await this.boxAuth()
          .getTokensAuthorizationCodeGrant(stateJson.code, null, (_err: any, tokenInfo: any): any => {
            return this.tokenStore.write(tokenInfo, async (_storeErr: any) => {
              return Promise.resolve(tokenInfo)
            })
          })
      } catch (_err) {
        winston.error(`Error requesting access_token: ${_err.toString()}`)
      }
    }
    if (result) {
      return result
    } else {
      winston.error("Invalid tokens")
    }
  }

  private boxAuth() {
    return new boxSDK({
      clientID: process.env.BOX_CLIENT_ID,
      clientSecret: process.env.BOX_CLIENT_SECRET,
    })
  }

  private async getClientFromRequest(request: Hub.ActionRequest, tokens: string) {
    if (request.params.state_json && tokens === "") {
      try {
        const json = JSON.parse(request.params.state_json)
        tokens = json.tokens
      } catch (er) {
        winston.error("cannot parse")
      }
    }
    return await this.boxAuth().getPersistentClient(tokens, this.tokenStore)
  }

  private generateFolderOptions(folders: any[]): FolderOption[] {
    const folderOptions = folders
      .filter((item) => item.type === "folder")
      .map((folder) => ({name: `${ROOT_FOLDER_NAME} / ${folder.name}`, id: folder.id}))

    return [{ name: ROOT_FOLDER_NAME, id: "0" }, ...folderOptions]
  }
}

Hub.addAction(new BoxAction())
