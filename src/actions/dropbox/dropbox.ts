import * as querystring from "querystring"
import * as https from "request-promise-native"
import {URL} from "url"

import Dropbox = require("dropbox")
import * as winston from "winston"
import * as Hub from "../../hub"

export class DropboxAction extends Hub.OAuthAction {
    name = "dropbox"
    label = "Dropbox"
    iconName = "dropbox/dropbox.png"
    description = "Send query results directly to a file in your Dropbox."
    supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
    usesStreaming = false
    minimumSupportedLookerVersion = "6.4.0"
    requiredFields = []
    params = [
      {
        description: "Dropbox Application Key",
        label: "Application Key",
        name: "appKey",
        required: true,
        sensitive: true,
      },
      {
        description: "Dropbox Secret Key",
        label: "Secret Key",
        name: "secretKey",
        required: true,
        sensitive: true,
      },
    ]

  async execute(request: Hub.ActionRequest) {
    const filename = request.formParams.filename
    const directory = request.formParams.directory
    const ext = request.attachment!.fileExtension

    let accessToken = ""
    if (request.params.state_json) {
      const jsonState = JSON.parse(request.params.state_json)
      if (jsonState.code && jsonState.redirect) {
        accessToken = await this.getAccessTokenFromCode(request)
      }
    }
    const drop = this.dropboxClientFromRequest(request, accessToken)

    const resp = new Hub.ActionResponse()
    if (request.attachment && request.attachment.dataBuffer) {
      const fileBuf = request.attachment.dataBuffer
      await drop.filesUpload({path: `/${directory}/${filename}.${ext}`, contents: fileBuf}).catch((err: any) => {
        winston.error(`Upload unsuccessful: ${JSON.stringify(err)}`)
        resp.success = false
        resp.state = new Hub.ActionState()
        resp.state.data = "reset"
      })
      resp.success = true
    } else {
      resp.success = false
      resp.message = "No data sent from Looker to be sent to Dropbox"
    }
    return resp
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = []

    let accessToken = ""
    if (request.params.state_json) {
      try {
        const jsonState = JSON.parse(request.params.state_json)
        if (jsonState.code && jsonState.redirect) {
          accessToken = await this.getAccessTokenFromCode(request)
        }
      } catch { winston.warn("Could not parse state_json") }
    }
    const drop = this.dropboxClientFromRequest(request, accessToken)
    try {
      const response = await drop.filesListFolder({path: ""})
      form.fields = [{
        description: "Dropbox directory where file will be saved",
        label: "Save in",
        name: "directory",
        options: response.entries.map((entries) => ({name: entries.name, label: entries.name})),
        required: true,
        type: "select",
      }, {
        label: "Filename",
        name: "filename",
        type: "string",
      }]
      if (accessToken !== "") {
        const newState = JSON.stringify({access_token: accessToken})
        form.state = new Hub.ActionState()
        form.state.data = newState
      } else {
        form.state = new Hub.ActionState()
      }
      return form
    } catch (_error) {
      const actionCrypto = new Hub.ActionCrypto()
      const jsonString = JSON.stringify({stateurl: request.params.state_url, app: request.params.appKey})
      const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err: string) => {
        winston.error("Encryption not correctly configured")
        throw err
      })
      form.state = new Hub.ActionState()
      form.fields.push({
        name: "login",
        type: "oauth_link",
        label: "Log in with Dropbox",
        oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth?state=${ciphertextBlob}`,
      })
      return(form)
    }
  }
  // async oauthUrl(redirectUri: string, stateUrl: string, encryptedState) {
  async oauthUrl(redirectUri: string, encryptedState: string) {
    const url = new URL("https://www.dropbox.com/oauth2/authorize")
    const actionCrypto = new Hub.ActionCrypto()
    const decryptedState = await actionCrypto.decrypt(encryptedState).catch((reason: any) => {
      throw reason
    })
    const jsonState = JSON.parse(decryptedState)
    url.search = querystring.stringify({
      response_type: "code",
      client_id: jsonState.app,
      redirect_uri: redirectUri,
      force_reapprove: true,
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

    const payload = JSON.parse(plaintext)
    await https.post({
      url: payload.stateurl,
      body: JSON.stringify({code: urlParams.code, redirect: redirectUri}),
    }).catch((_err) => { winston.error(_err.toString()) })
    return `<html><script>window.close()</script>></html>`
  }

  async oauthCheck(request: Hub.ActionRequest) {
    let res = false
    const drop = this.dropboxClientFromRequest(request, "")
    await drop.filesListFolder({path: ""})
      .then(() => {
        res = true
      })
      .catch((error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) => {
        winston.error(error.error.toString())
      })
    return res
  }

  protected async getAccessTokenFromCode(request: Hub.ActionRequest) {
    const url = new URL("https://api.dropboxapi.com/oauth2/token")
    let stateJson
    if (request.params.state_json) {
      stateJson = JSON.parse(request.params.state_json)
    } else {
      throw "state_json not present"
    }
    if (stateJson.code && stateJson.redirect) {
      url.search = querystring.stringify({
        grant_type: "authorization_code",
        code: stateJson.code,
        client_id: request.params.appKey,
        client_secret: request.params.secretKey,
        redirect_uri: stateJson.redirect,
      })
    } else {
      throw "state_json does not contain correct members"
    }
    return await https.post(url.toString(), { json: true })
        .catch((_err) => { winston.error("Error requesting access_token") })
  }

  protected dropboxClientFromRequest(request: Hub.ActionRequest, token: string) {
    if (request.params.state_json && token === "") {
      try {
        const json = JSON.parse(request.params.state_json)
        token = json.access_token
      } catch (er) {
        winston.error("cannot parse")
      }
    }
    return new Dropbox({accessToken: token})
  }
}

Hub.addAction(new DropboxAction())
