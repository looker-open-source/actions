import * as querystring from "querystring"
import * as req from "request-promise-native"
import { URL } from "url"

import Dropbox = require("dropbox")

import * as winston from "winston"
import * as Hub from "../../hub"

export class DropboxAction extends Hub.OAuthAction {
    name = "dropbox"
    label = "Dropbox"
    iconName = "dropbox/dropbox.png"
    description = "Send query results directly to a file in your Dropbox."
    supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query, Hub.ActionType.Dashboard]
    usesStreaming = false
    requiredFields = []
    params = [{
      name: "dropbox_access_token",
      label: "Dropbox Access token",
      required: false,
      sensitive: true,
    }]
  async execute(request: Hub.ActionRequest) {
    let token = ""
    const filename = request.formParams.filename
    const directory = request.formParams.directory
    const ext = request.attachment!.fileExtension
    if (request.params.state_json) {
        try {
            const json = JSON.parse(request.params.state_json)
            token = json.access_token
        } catch (er) {
            winston.error("cannot parse")
        }
    }
    const drop = new Dropbox({ accessToken: token })
    const resp = new Hub.ActionResponse()
    const fileBuf = request.attachment!.dataBuffer || Buffer.from("")
    await drop.filesUpload({path: `/${directory}/${filename}.${ext}`, contents: fileBuf}).then( (_dropResp) => {
      resp.success = true
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
    }).catch( (err) => {
      winston.error(`Upload unsuccessful: ${JSON.stringify(err)}`)
      resp.success = false
      resp.state = new Hub.ActionState()
      resp.state.data = "reset"
    })
    return resp
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = []
    let token = ""
    if (request.params.state_json) {
        try {
            const json = JSON.parse(request.params.state_json)
            token = json.access_token
        } catch (er) {
            winston.error("cannot parse")
        }
    }

    const drop = new Dropbox({ accessToken: token})
    await drop.filesListFolder({path: ""})
        .then( (resp) => {
            winston.info(JSON.stringify(resp))
            form.fields = [{
                description: "Dropbox directory where file will be saved",
                label: "Save in",
                name: "directory",
                options: resp.entries.map((entries) => ({ name: entries.name, label: entries.name })),
                required: true,
                type: "select",
            }, {
              label: "Filename",
              name: "filename",
              type: "string",
            }]
        })
        .catch((_error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) => {
            winston.info(`OAUTH: ${process.env.ACTION_HUB_BASE_URL}/dropbox/oauth`)
            const state = new Hub.ActionState()
            form.state = state
            form.fields.push({
                name: "login",
                type: "oauth_link",
                label: "Log in with Dropbox",
                oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth`,
            })
        })
    return form
  }

  async oauthUrl(redirectUri: string, stateUrl: string) {
    const url = new URL("https://www.dropbox.com/oauth2/authorize")
    url.search = querystring.stringify({
      response_type: "code",
      client_id: process.env.DROPBOX_ACTION_APP_KEY,
      redirect_uri: redirectUri,
      state: stateUrl,
    })
    return url.toString()
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const url = new URL("https://api.dropboxapi.com/oauth2/token")
    url.search = querystring.stringify({
      code: urlParams.code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      client_id: process.env.DROPBOX_ACTION_APP_KEY,
      client_secret: process.env.DROPBOX_ACTION_APP_SECRET,
    })
    const res = await req.post(url.toString(), { json: true })
    const https = require("request")
    await https.get({
        url: urlParams.state,
        rejectUnauthorized: false,
        strictSSL: false,
        body: JSON.stringify({access_token: res.access_token}),
    })
    return JSON.stringify({ token: res.access_token, state: urlParams.state })
  }

  async oauthCheck(request: Hub.ActionRequest) {
      let token = ""
      if (request.params.state_json) {
          const json = JSON.parse(request.params.state_json)
          token = json.access_token
      }
      let res = false
      const drop = new Dropbox({accessToken: token})
      await drop.filesListFolder({path: ""})
          .then((resp) => {
              winston.info(resp.entries[0].name)
              res = true
          })
          .catch((error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) => {
              winston.error(error.error.toString())
          })
      return res
  }
}

if (process.env.DROPBOX_ACTION_APP_KEY && process.env.DROPBOX_ACTION_APP_SECRET) {
  Hub.addAction(new DropboxAction())
}
