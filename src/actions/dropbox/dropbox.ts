import { URL } from 'url'
import * as querystring from 'querystring'
import * as req from "request-promise-native"

// import Dropbox = require('dropbox')

import * as Hub from "../../hub"

export class DropboxAction extends Hub.OAuthAction {

  constructor() {
    super()
    this.name = "dropbox"
    this.label = "Dropbox"
    this.iconName = "dropbox/dropbox.png"
    this.description = "Send query results directly to a file in your Dropbox."
    this.supportedActionTypes = [Hub.ActionType.Cell]
    this.requiredFields = [{any_tag: ["dropbox_test"]}]
    this.params = [{
      name: "dropbox_refresh_token",
      label: "Dropbox API Token",
      per_user: true,
      required: true,
      sensitive: true
    }]
  }

  async execute(_request: Hub.ActionRequest) {
    return new Hub.ActionResponse()
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = []
    if (request.params.dropbox_refresh_token) {
      form.fields.push({
        name: "You gotta token"
      })
    } else {
      form.fields.push({
        name: "login",
        type: "set_params_link",
        label: "Log in with Dropbox",
        url: "http://localhost:8080/actions/dropbox/oauth"
      })
    }
    return form
  }

  async oauthUrl(redirectUri: string) {
    const url = new URL("https://www.dropbox.com/oauth2/authorize")
    url.search = querystring.stringify({
      response_type: "code",
      client_id: process.env.DROPBOX_ACTION_APP_KEY,
      redirect_uri: redirectUri
    })
    return url.toString()
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const url = new URL("https://api.dropboxapi.com/oauth2/token")
    url.search = querystring.stringify({
      code: urlParams.code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      client_id: process.env.DROPBOX_ACTION_APP_KEY,
      client_secret: process.env.DROPBOX_ACTION_APP_SECRET,
    })
    const res = await req.post(url.toString(), { json: true })
    return JSON.stringify({ token: res.access_token })
  }

}

if (process.env.DROPBOX_ACTION_APP_KEY && process.env.DROPBOX_ACTION_APP_SECRET) {
  Hub.addAction(new DropboxAction())
}
