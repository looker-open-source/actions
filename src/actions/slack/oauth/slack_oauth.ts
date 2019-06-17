import * as Hub from "../../../hub"

import * as querystring from "querystring"
import * as https from "request-promise-native"
import {URL} from "url"
import * as winston from "winston"

import { WebClient } from "@slack/client"
import { WebClientUtilities } from "../webclient_utilities"

export class SlackAttachmentOauthAction extends Hub.OAuthAction {

  name = "slack_oauth"
  label = "Slack Attachment Oauth"
  iconName = "slack/slack.png"
  description = "Write a data file to Slack."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  minimumSupportedLookerVersion = "6.8.0"
  requiredFields = []
  params = []

  async execute(request: Hub.ActionRequest) {

    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams.channel) {
      throw "Missing channel."
    }

    const fileName = request.formParams.filename || request.suggestedFilename()

    const options = {
      file: request.attachment.dataBuffer,
      filename: fileName,
      channels: request.formParams.channel,
      filetype: request.attachment.fileExtension,
      initial_comment: request.formParams.initial_comment ? request.formParams.initial_comment : "",
    }

    let response
    try {
      const slack = this.slackClientFromRequest(request)
      await slack.files.upload(options)
      response = new Hub.ActionResponse({success: true})
    } catch (e) {
      response = new Hub.ActionResponse({success: false})
      response.state = new Hub.ActionState()
      response.state.data = "reset"
    }
    return response
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    try {
      const slack = this.slackClientFromRequest(request)
      const slackUtility = new WebClientUtilities(slack)
      const channels = await slackUtility.usableChannels()

      form.fields = [{
        description: "Name of the Slack channel you would like to post to.",
        label: "Share In",
        name: "channel",
        options: channels.map((channel) => ({ name: channel.id, label: channel.label })),
        required: true,
        type: "select",
      }, {
        label: "Comment",
        type: "string",
        name: "initial_comment",
      }, {
        label: "Filename",
        name: "filename",
        type: "string",
      }]

    } catch (e) {
      const actionCrypto = new Hub.ActionCrypto()
      const jsonString = JSON.stringify({stateurl: request.params.state_url})
      const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err: string) => {
        winston.error("Encryption not correctly configured")
        throw err
      })
      form.state = new Hub.ActionState()
      form.state.data = "reset"
      form.fields.push({
        name: "login",
        type: "oauth_link",
        label: "Log in",
        description: "In order to send to a file, you will need to log in" +
          " once to your Slack account.",
        oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/slack_oauth/oauth?state=${ciphertextBlob}`,
      })
    }

    return form
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    const url = new URL("https://slack.com/oauth/authorize")
    url.search = querystring.stringify({
      client_id: process.env.SLACK_CLIENT,
      redirect_uri: redirectUri,
      state: encryptedState,
      scope: "channels:read,chat:write:user,files:write:user,groups:read,users:read",
    })
    return url.toString()
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })

    const credentials = await this.getCredentialsFromCode(urlParams.code, redirectUri)

    const payload = JSON.parse(plaintext)
    await https.post({
      url: payload.stateurl,
      body: JSON.stringify(credentials),
    }).catch((_err) => { winston.error(_err.toString()) })
  }

  async oauthCheck(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    try {
      await slack.channels.list()
      return true
    } catch (err) {
      return false
    }
  }

  protected async getCredentialsFromCode(code: string, redirect: string, refresh = false) {
    const url = new URL("https://slack.com/api/oauth.access")

    if (code) {
      url.search = querystring.stringify({
        client_id: process.env.SLACK_CLIENT,
        client_secret: process.env.SLACK_SECRET,
        code,
        redirect_uri: redirect,
        grant_type: refresh ? "refresh_token" : "authorization_code",
      })
    } else {
      throw "code does not exist"
    }
    const response = await https.post(url.toString(), { json: true })
      .catch((_err) => { winston.error("Error requesting access_token") })
    return response
  }

  private slackClientFromRequest(request: Hub.ActionRequest) {
    let accessToken = ""
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        accessToken = stateJson.access_token
      } catch {
        winston.warn("Could not parse state_json")
        throw "Bad things"
      }
    }
    return new WebClient(accessToken)
  }
}

if (process.env.SLACK_CLIENT && process.env.SLACK_SECRET) {
  Hub.addAction(new SlackAttachmentOauthAction())
}
