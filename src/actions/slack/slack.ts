import * as Hub from "../../hub"
import * as winston from "winston"

import { WebClient } from "@slack/client"

const apiLimitSize = 1000

interface Channel {
  id: string,
  label: string,
}

export class SlackAttachmentAction extends Hub.OAuthAction {

  name = "slack"
  label = "Slack Attachment"
  iconName = "slack/slack.png"
  description = "Write a data file to Slack."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "slack_api_token",
    label: "Slack API Token",
    required: false,
    description: `A Slack API token that includes the permissions "channels:read", \
"users:read", and "files:write:user". You can follow the instructions to get a token at \
https://github.com/looker/actions/blob/master/src/actions/slack/README.md`,
    sensitive: true,
  }]
  usesStreaming = true

  async execute(request: Hub.ActionRequest) {

    if (!request.formParams.channel) {
      throw "Missing channel."
    }

    const fileName = request.formParams.filename || request.suggestedFilename()

    let response = new Hub.ActionResponse({success: true})
    try {
      const slack = this.slackClientFromRequest(request)
      await request.stream(async (readable) => {
        await slack.files.upload({
          file: readable,
          filename: fileName,
          channels: request.formParams.channel,
          initial_comment: request.formParams.initial_comment ? request.formParams.initial_comment : "",
        })
      })
    } catch (e) {
      response = new Hub.ActionResponse({success: false, message: e.message})
      if (!request.params.slack_api_token) {
        response.state = new Hub.ActionState()
        // response.state.data = "reset"
      }
    }
    return response
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
      if (!request.params.slack_api_token) {
        const oauthUrl = request.params.state_url || ""
        form.state = new Hub.ActionState()
        form.fields.push({
          name: "login",
          type: "oauth_link",
          label: "Log in",
          description: "In order to send to a file, you will need to log in" +
            " once to your Slack account.",
          oauth_url: oauthUrl,
        })
      } else {
        form.error = this.prettySlackError(e)
      }
    }
    return form
  }

  async usableChannels(request: Hub.ActionRequest) {
    let channels = await this.usablePublicChannels(request)
    channels = channels.concat(await this.usableDMs(request))
    channels.sort((a, b) => ((a.label < b.label) ? -1 : 1 ))
    return channels
  }

  async usablePublicChannels(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    const options: any = {
      exclude_archived: true,
      exclude_members: true,
      limit: apiLimitSize,
    }
    const pageLoaded = async (accumulatedChannels: any[], response: any): Promise<any[]> => {
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
      limit: apiLimitSize,
    }
    const pageLoaded = async (accumulatedUsers: any[], response: any): Promise<any[]> => {
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

  async oauthUrl() {
    winston.error("Unsupported Slack oauthUrl")
    return ""
  }

  async oauthFetchInfo() {
    winston.error("Unsupported Slack oauthFetchInfo")
    return Promise.resolve()
  }

  async oauthCheck(request: Hub.ActionRequest) {
    if (!request.params.slack_api_token) {
      const slack = this.slackClientFromRequest(request)
      try {
        await slack.channels.list()
        return true
      } catch (err) {
        return false
      }
    } else {
      return false
    }
  }

  protected async getCredentialsFromCode() {
    throw "unsupported"
  }

  private prettySlackError(e: any) {
    if (e.message === "An API error occurred: invalid_auth") {
      return "Your Slack authentication credentials are not valid."
    } else {
      return e
    }
  }

  private slackClientFromRequest(request: Hub.ActionRequest) {
    if (!request.params.slack_api_token) {
      return this.slackClient(request.params.state_json)
    } else {
      return this.slackClient(request.params.slack_api_token)
    }
  }

  private slackClient(token?: string) {
    return new WebClient(token)
  }
}

Hub.addAction(new SlackAttachmentAction())
