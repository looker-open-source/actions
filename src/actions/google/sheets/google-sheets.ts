import * as querystring from "querystring"
import * as https from "request-promise-native"
import {URL} from "url"

import { google } from "googleapis"
import * as winston from "winston"
import * as Hub from "../../../hub"

export class GoogleSheetsAction extends Hub.OAuthAction {
    name = "google-sheets"
    label = "Google Sheets"
    iconName = "google/sheets/sheets.svg"
    description = "Create a new Google Sheet."
    supportedActionTypes = [Hub.ActionType.Query]
    usesStreaming = false
    minimumSupportedLookerVersion = "6.8.0"
    requiredFields = []
    params = []

  async execute(request: Hub.ActionRequest) {
    const filename = request.formParams.filename

    let accessToken = ""
    if (request.params.state_json) {
      const stateJson = JSON.parse(request.params.state_json)
      if (stateJson.code && stateJson.redirect) {
        accessToken = await this.getAccessTokenFromCode(stateJson)
      }
    }
    const client = this.sheetsClientFromRequest(request, accessToken)
    const sheets = google.sheets("v4")

    const resp = new Hub.ActionResponse()
    resp.success = true
    if (request.attachment && request.attachment.dataBuffer) {
      const fileBuf = request.attachment.dataBuffer
      await sheets.create({
        auth: client,
      }).catch(() => {
        resp.success = false
        resp.state = new Hub.ActionState()
        resp.state.data = "reset"
      })
    } else {
      resp.success = false
      resp.message = "No data sent from Looker to be sent to Dropbox."
    }
    return resp
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = []

    let accessToken = ""
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.code && stateJson.redirect) {
          accessToken = await this.getAccessTokenFromCode(stateJson)
        }
      } catch { winston.warn("Could not parse state_json") }
    }
    const drop = this.dropboxClientFromRequest(request, accessToken)
    try {
      form.fields = [{
        label: "Enter a name",
        name: "filename",
        type: "string",
        required: true,
      }]
      if (accessToken !== "") {
        const newState = JSON.stringify({access_token: accessToken})
        form.state = new Hub.ActionState()
        form.state.data = newState
      }
      return form
    } catch (_error) {
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
        oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google-sheets/oauth?state=${ciphertextBlob}`,
      })
      return(form)
    }
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_SHEETS_CLIENT_ID,
      process.env.GOOGLE_SHEETS_CLIENT_SECRET,
      redirectUri,
    )

    // generate a url that asks permissions for Google Sheets scope
    const scopes = [
      "https://www.googleapis.com/auth/spreadsheets",
    ]

    const url = oauth2Client.generateAuthUrl({
      // 'online' (default) or 'offline' (gets refresh_token)
      access_type: "offline",
      scope: scopes,
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
  }

  async oauthCheck(request: Hub.ActionRequest) {
    const sheets = this.sheetsClientFromRequest(request, "")
    return true
  }

  protected sheetsClientFromRequest(request: Hub.ActionRequest, token: string) {
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

if (process.env.DROPBOX_ACTION_APP_KEY && process.env.DROPBOX_ACTION_APP_SECRET) {
  Hub.addAction(new DropboxAction())
}
