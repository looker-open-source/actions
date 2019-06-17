import * as Hub from "../../hub"

import { WebClient } from "@slack/client"
import { prettySlackError, WebClientUtilities } from "./webclient_utilities"

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
      response = new Hub.ActionResponse({success: false, message: e.message })
    }
    return new Hub.ActionResponse(response)
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
      form.error = prettySlackError(e)
    }

    return form
  }

  slackClientFromRequest(request: Hub.ActionRequest) {
    return new WebClient(request.params.slack_api_token!)
  }

}

Hub.addAction(new SlackAttachmentAction())
