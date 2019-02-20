import * as Hub from "../../hub"

import { WebClient } from "@slack/client"

interface Channel {
  id: string,
  label: string,
}

export class SlackAttachmentAction extends Hub.Action {

  name = "slack"
  label = "Slack Attachment"
  iconName = "slack/slack.png"
  description = "Write a data file to Slack."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "slack_api_token",
    label: "Slack API Token",
    required: true,
    description: `A Slack API token that includes the permissions "channels:read", \
"users:read", and "files:write:user". You can follow the instructions to get a token at \
https://github.com/looker/actions/blob/master/src/actions/slack/README.md`,
    sensitive: true,
  }]

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
      form.error = this.prettySlackError(e)
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

  private prettySlackError(e: any) {
    if (e.message === "An API error occurred: invalid_auth") {
      return "Your Slack authentication credentials are not valid."
    } else {
      return e
    }
  }

  private slackClientFromRequest(request: Hub.ActionRequest) {
    return new WebClient(request.params.slack_api_token!)
  }

}

Hub.addAction(new SlackAttachmentAction())
