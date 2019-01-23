import * as querystring from "querystring"
import * as https from "request-promise-native"
import {URL} from "url"

import Dropbox = require("dropbox")
import * as winston from "winston"
import {AwsKms} from "../../crypto/aws_kms"
import * as Hub from "../../hub"

export class DropboxAction extends Hub.OAuthAction {
    name = "dropbox"
    label = "Dropbox"
    iconName = "dropbox/dropbox.png"
    description = "Send query results directly to a file in your Dropbox."
    supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
    usesStreaming = false
    minimumSupportedLookerVersion = "6.2.0"
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

    const drop = this.dropboxClientFromRequest(request)
    const resp = new Hub.ActionResponse()
    if (request.attachment && request.attachment.dataBuffer) {
      const fileBuf = request.attachment.dataBuffer
      await drop.filesUpload({path: `/${directory}/${filename}.${ext}`, contents: fileBuf}).then((_dropResp) => {
        resp.success = true
        resp.state = new Hub.ActionState()
        resp.state.data = "reset"
      }).catch((err: any) => {
        winston.error(`Upload unsuccessful: ${JSON.stringify(err)}`)
        resp.success = false
        resp.state = new Hub.ActionState()
        resp.state.data = "reset"
      })
    } else {
      resp.success = false
      resp.message = "No data sent from Looker to be sent to Dropbox"
    }
    return resp
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = []

    const drop = this.dropboxClientFromRequest(request)
    return new Promise<Hub.ActionForm>((resolve, reject) => {
      drop.filesListFolder({path: ""})
        .then((resp) => {
          form.fields = [{
            description: "Dropbox directory where file will be saved",
            label: "Save in",
            name: "directory",
            options: resp.entries.map((entries) => ({name: entries.name, label: entries.name})),
            required: true,
            type: "select",
          }, {
            label: "Filename",
            name: "filename",
            type: "string",
          }]
          resolve(form)
        })
        .catch((_error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) => {
          winston.info("Could not list Dropbox folders")
          const creds = JSON.stringify({app: request.params.appKey, secret: request.params.secretKey})
          const kms = new AwsKms()
          kms.encrypt(creds).then((ciphertextBlob: string) => {
            form.state = new Hub.ActionState()
            form.fields.push({
              name: "login",
              type: "oauth_link",
              label: "Log in with Dropbox",
              oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth?state=${ciphertextBlob}`,
            })
            resolve(form)
          }).catch((err: string) => {
            winston.error("Encryption not correctly configured")
            reject(err)
          })
        })
    })
  }
  // async oauthUrl(redirectUri: string, stateUrl: string, encryptedState) {
  async oauthUrl(redirectUri: string, stateUrl: string, encryptedState: string) {
    const url = new URL("https://www.dropbox.com/oauth2/authorize")
    const kms = new AwsKms()
    const decryptedState = await kms.decrypt(encryptedState).catch((reason: any) => {
      throw reason
    })
    const jsonState = JSON.parse(decryptedState)
    url.search = querystring.stringify({
      response_type: "code",
      client_id: jsonState.app,
      redirect_uri: redirectUri,
      state: JSON.stringify({lookerstateurl: stateUrl, creds: encryptedState}),
    })
    return url.toString()
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const url = new URL("https://api.dropboxapi.com/oauth2/token")
    const kms = new AwsKms()
    const jsonState = JSON.parse(urlParams.state)
    const plaintext = await kms.decrypt( jsonState.creds ).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })

    const payload = JSON.parse(plaintext)
    url.search = querystring.stringify({
      grant_type: "authorization_code",
      code: urlParams.code,
      client_id: payload.app,
      client_secret: payload.secret,
      redirect_uri: redirectUri,
    })

    const response = await https.post(url.toString(), { json: true }).catch()
    // process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0" // Localhost development hack
    await https.get({
      url: jsonState.lookerstateurl,
      body: JSON.stringify({access_token: response.access_token}),
    }).catch()
    return "<html><script>window.close()</script>></html>"
  }

  async oauthCheck(request: Hub.ActionRequest) {
    let res = false
    const drop = this.dropboxClientFromRequest(request)
    await drop.filesListFolder({path: ""})
      .then(() => {
        res = true
      })
      .catch((error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) => {
        winston.error(error.error.toString())
      })
    return res
  }

  protected dropboxClientFromRequest(request: Hub.ActionRequest) {
    let token = ""
    if (request.params.state_json) {
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
