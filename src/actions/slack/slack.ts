import * as Hub from "../../hub"

import { WebClient } from "@slack/client"
import * as winston from "winston"
import {displayError, getDisplayedFormFields, handleExecute} from "./utils"

interface AuthTestResult {
  ok: boolean,
  user: string,
  user_id: string,
  team: string,
  team_id: string,
}

export class SlackAction extends Hub.DelegateOAuthAction {

  name = "slack_app"
  label = "Slack (Beta)"
  iconName = "slack/slack.png"
  description = "Explore and share Looker content in Slack."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "install",
    label: "Connect to Slack",
    delegate_oauth_url: "/admin/integrations/slack/install",
    required: false,
    sensitive: false,
    description: `View dashboards and looks,
     browse your favorites or folders, and interact with Looker content without leaving Slack.`,
  }]
  minimumSupportedLookerVersion = "6.23.0"
  usesStreaming = true

  async execute(request: Hub.ActionRequest) {
    return await handleExecute(request, this.slackClientFromRequest(request))
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const stateJson = request.params.state_json
    if (request.lookerVersion === '7.1.0' && Array.isArray(stateJson) && stateJson.length > 0) {
      const clients = stateJson.map((accessToken) => new WebClient(accessToken))
      const authRequests = clients.map(
          (client) => client.auth.test() as Promise<AuthTestResult>
      )

      const authResponse = await Promise.all(authRequests)

      const foundClientIndex = request.formParams.workspace ?
          authResponse.findIndex(r => r.team_id === request.formParams.workspace) :
          0
      winston.info(`clients.length ${clients.length}`)
      winston.info(`clients[foundClientIndex] ${clients[foundClientIndex]}`)
      form.fields = await getDisplayedFormFields(clients[foundClientIndex], false)
      form.fields.unshift({
        description: "Name of the Slack workspace you would like to share in.",
        label: "Workspace",
        name: "workspace",
        options: authResponse.map((response) => ({ name: response.team_id, label: response.team })),
        required: true,
        default: request.formParams.workspace ? undefined : authResponse[0].team_id,
        interactive: true,
        type: "select",
      })

    } else {
      try {
        form.fields = await getDisplayedFormFields(this.slackClientFromRequest(request), false)
      } catch (e) {
        const oauthUrl = request.params.state_url
        if (oauthUrl) {
          form.state = new Hub.ActionState()
          form.fields.push({
            name: "login",
            type: "oauth_link",
            label: "Log in",
            description: "In order to send to a file, you will need to log in to your Slack account.",
            oauth_url: oauthUrl,
          })
        } else {
          form.error = "Illegal State: state_url is empty."
        }
      }
    }
    return form
  }

  async authTest(request: Hub.ActionRequest) {
    const slack = this.slackClientFromRequest(request)
    return await slack.auth.test() as AuthTestResult
  }

  async oauthCheck(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    if (!request.params.state_json) {
        form.error = "You must connect to a Slack workspace first."
        return form
    }
    try {
      const resp = await this.authTest(request)

      form.fields.push({
        name: "Connected",
        type: "message",
        value: `Connected with ${resp.team} (${resp.team_id})`,
      })
    } catch (e) {
      form.error = displayError[e.message] || e
    }
    return form
  }

  private slackClientFromRequest(request: Hub.ActionRequest) {
      return new WebClient(request.params.state_json)
  }
}

Hub.addAction(new SlackAction())
