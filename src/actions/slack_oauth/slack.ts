import * as Hub from "../../hub"

import { WebClient } from "@slack/client"
import * as querystring from "querystring"
import * as https from "request-promise-native"
import {URL} from "url"
import * as winston from "winston"

interface Channel {
  id: string,
  label: string,
}

export class SlackAttachmentOauthAction extends Hub.OAuthAction {

  name = "slack_oauth"
  label = "Slack Attachment Oauth"
  iconName = "slack_oauth/slack.png"
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
      await new Promise<void>((resolve, reject) => {
        slack.files.upload(options, (err: any) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    } catch (e) {
      response = { success: false, message: e.message }
    }
    return new Hub.ActionResponse(response)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    try {
      const channels = await this.usableChannels(request)

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
      form.fields.push({
        name: "login",
        type: "oauth_link",
        label: "Log in",
        description: "In order to send to a Dropbox file or folder now and in the future, you will need to log in" +
          " once to your Dropbox account.",
        oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/slack_oauth/oauth?state=${ciphertextBlob}`,
      })
    }

    return form
  }

  async usableChannels(request: Hub.ActionRequest) {
    let channels = await this.usablePublicChannels(request)
    channels = channels.concat(await this.usableDMs(request))
    return channels
  }

  async usablePublicChannels(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    const options: any = {
      exclude_archived: true,
      exclude_members: true,
      limit: 200,
    }
    async function pageLoaded(accumulatedChannels: any[], response: any): Promise<any[]> {
      const mergedChannels = accumulatedChannels.concat(response.channels)

      // When a `next_cursor` exists, recursively call this function to get the next page.
      if (response.response_metadata &&
          response.response_metadata.next_cursor &&
          response.response_metadata.next_cursor !== "") {
        const pageOptions = { ...options }
        pageOptions.cursor = response.response_metadata.next_cursor
        return pageLoaded(mergedChannels, await slack.channels.list(pageOptions))
      }
      return mergedChannels
    }
    const paginatedChannels = await pageLoaded([], await slack.channels.list(options))
    const channels = paginatedChannels.filter((c: any) => c.is_member && !c.is_archived)
    const reformatted: Channel[] = channels.map((channel: any) => ({id: channel.id, label: `#${channel.name}`}))
    return reformatted
  }

  async usableDMs(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    const options: any = {
      limit: 200,
    }
    async function pageLoaded(accumulatedUsers: any[], response: any): Promise<any[]> {
      const mergedUsers = accumulatedUsers.concat(response.members)

      // When a `next_cursor` exists, recursively call this function to get the next page.
      if (response.response_metadata &&
          response.response_metadata.next_cursor &&
          response.response_metadata.next_cursor !== "") {
        const pageOptions = { ...options }
        pageOptions.cursor = response.response_metadata.next_cursor
        return pageLoaded(mergedUsers, await slack.users.list(pageOptions))
      }
      return mergedUsers
    }
    const paginatedUsers = await pageLoaded([], await slack.users.list(options))
    const users = paginatedUsers.filter((u: any) => {
      return !u.is_restricted && !u.is_ultra_restricted && !u.is_bot && !u.deleted
    })
    const reformatted: Channel[] = users.map((user: any) => ({id: user.id, label: `@${user.name}`}))
    return reformatted
  }

  // "channels:read+chat:write:user+files:write:user+groups:read+users:read"
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

    const accessToken = await this.getAccessTokenFromCode(urlParams.code, redirectUri)

    const payload = JSON.parse(plaintext)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
    await https.post({
      url: payload.stateurl,
      body: JSON.stringify({access_token: accessToken}),
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

  protected async getAccessTokenFromCode(code: string, redirect: string) {
    const url = new URL("https://slack.com/api/oauth.access")

    if (code) {
      url.search = querystring.stringify({
        client_id: process.env.SLACK_CLIENT,
        client_secret: process.env.SLACK_SECRET,
        code,
        redirect_uri: redirect,
      })
    } else {
      throw "code does not exist"
    }
    const response = await https.post(url.toString(), { json: true })
      .catch((_err) => { winston.error("Error requesting access_token") })
    return response.access_token
  }

  private slackClientFromRequest(request: Hub.ActionRequest) {
    let accessToken = ""
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        accessToken = stateJson.access_token
      } catch { winston.warn("Could not parse state_json") }
    }
    return new WebClient(accessToken)
  }
}

if (process.env.SLACK_CLIENT && process.env.SLACK_SECRET) {
  Hub.addAction(new SlackAttachmentOauthAction())
}
