import * as Hub from "../../../hub"

import {WebClient} from "@slack/web-api"
import {displayError, getDisplayedFormFields, handleExecute} from "../utils"

export class SlackAttachmentAction extends Hub.Action {

  name = "slack"
  label = "Slack Attachment (API Token)"
  iconName = "slack/legacy_slack/slack.png"
  description = "Write a data file to Slack using a bot user token or legacy API token."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "slack_api_token",
    label: "Slack API Token",
    required: true,
    description: `A Slack API token that includes the permissions "channels:read", \
"users:read", "groups:read", and "files:write:user". Follow the instructions to get a token at \
https://github.com/looker/actions/blob/master/src/actions/slack/legacy_slack/README.md`,
    sensitive: true,
  }]
  usesStreaming = false
  executeInOwnProcess = true

  async execute(request: Hub.ActionRequest) {
    return await handleExecute(request, this.slackClientFromRequest(request, true))
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const channelType = request.formParams.channelType ? request.formParams.channelType : "manual"
    try {
      form.fields = await getDisplayedFormFields(this.slackClientFromRequest(request), channelType)
    } catch (e: any) {
      form.error = displayError[e.message] || e
    }

    return form
  }

  private slackClientFromRequest(request: Hub.ActionRequest, disableRetries = false) {
    if (disableRetries) {
      return new WebClient(request.params.slack_api_token!, {retryConfig: {retries: 0}})
    } else {
      return new WebClient(request.params.slack_api_token!)
    }
  }

}

Hub.addAction(new SlackAttachmentAction())
