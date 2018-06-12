import { URL } from 'url'
import * as querystring from 'querystring'
import * as req from "request-promise-native"

import Dropbox = require('dropbox')

import * as Hub from "../../hub"
import * as winston from "winston"

export class DropboxAction extends Hub.OAuthAction {
    name = "dropbox"
    label = "Dropbox"
    iconName = "dropbox/dropbox.png"
    description = "Send query results directly to a file in your Dropbox."
    supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query]
    supportedDownloadSettings = ["url"]
    requiredFields = []
    params = [{
      name: "dropbox_access_token",
      label: "Dropbox Access token",
      per_user: true,
      required: false,
      sensitive: true,
    }]
  async execute(_request: Hub.ActionRequest) {
    winston.info("EXCECUTE: ")
    const resp = new Hub.ActionResponse()
    resp.state = new Hub.ActionState()
    resp.state.data = "lololol"
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
        .then(function (resp) {
            winston.info(resp.entries[0].name)
            form.fields.push({
                name: "You gotta token",
            })
        })
        .catch(function (error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) {
            winston.error(error.error.toString())
            const state = new Hub.ActionState()
            state.data = "http://localhost:1337/actions/dropbox/oauth"
            state.reset = true
            form.state = state
            form.fields.push({
                name: "login",
                type: "external_link",
                label: "Log in with Dropbox",
                url: "http://localhost:1337/actions/dropbox/oauth",
            })
        })
    return form
  }

  async oauthUrl(redirectUri: string, token: string) {
    const url = new URL("https://www.dropbox.com/oauth2/authorize")
    url.search = querystring.stringify({
      response_type: "code",
      client_id: process.env.DROPBOX_ACTION_APP_KEY,
      redirect_uri: redirectUri,
      state: token,
    })
    return url.toString()
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const url = new URL("https://api.dropboxapi.com/oauth2/token")
    winston.info("In the oauth token! --> " + urlParams["state"].toString())
    url.search = querystring.stringify({
      code: urlParams.code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      client_id: process.env.DROPBOX_ACTION_APP_KEY,
      client_secret: process.env.DROPBOX_ACTION_APP_SECRET,
    })
    const res = await req.post(url.toString(), { json: true })
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    const https = require("request")
    const res2 = await https.get({
        url: "https://self-signed.looker.com:9999/action_hub_state/" + urlParams["state"],
        rejectUnauthorized: false,
        strictSSL: false,
        body: JSON.stringify({access_token: res.access_token}),
    })
    winston.warn("can oauth pls? = " + res2)
    return JSON.stringify({ token: res.access_token, state: urlParams["state"] })
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
          .then(function (resp) {
              winston.info(resp.entries[0].name)
              res = true
          })
          .catch(function (error: DropboxTypes.Error<DropboxTypes.files.ListFolderError>) {
              winston.error(error.error.toString())
          })
      return res
  }
}

if (process.env.DROPBOX_ACTION_APP_KEY && process.env.DROPBOX_ACTION_APP_SECRET) {
  Hub.addAction(new DropboxAction())
}
