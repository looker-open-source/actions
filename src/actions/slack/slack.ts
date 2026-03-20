import {WebClient} from "@slack/web-api"
import {WebAPICallResult} from "@slack/web-api/dist/WebClient"
import * as winston from "winston"
import { AESTransitCrypto } from "../../crypto/aes_transit_crypto"
import {HTTP_ERROR} from "../../error_types/http_errors"
import * as Hub from "../../hub"
import {Error, errorWith} from "../../hub/action_response"
import {isSupportMultiWorkspaces, SlackClientManager} from "./slack_client_manager"
import {displayError, getDisplayedFormFields, handleExecute} from "./utils"

interface AuthTestResult {
  ok: boolean,
  team: string,
  team_id: string,
}

const AUTH_MESSAGE = "You must connect to a Slack workspace first."
const LOG_PREFIX = "[SLACK]"

export class SlackAction extends Hub.DelegateOAuthAction {

  name = "slack_app"
  label = "Slack"
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
  executeInOwnProcess = true

  /**
   * Executes the Slack action.
   * Decrypts state_json if it was previously encrypted and passes it to the client manager.
   * If execution succeeds and the feature flag is on, it encrypts the state before returning.
   */
  async execute(request: Hub.ActionRequest) {
    const resp = new Hub.ActionResponse()
    const decryptedState = await this.decryptStateIfNeeded(request)
    const clientManager = new SlackClientManager(request, true, decryptedState)
    const selectedClient = clientManager.getSelectedClient()
    if (!selectedClient) {
      const error: Error = errorWith(
        HTTP_ERROR.bad_request,
        `${LOG_PREFIX} Missing client`,
      )

      resp.error = error
      resp.message = error.message
      resp.webhookId = request.webhookId
      resp.success = false

      winston.error(`${error.message}`, {error, webhookId: request.webhookId})
      return resp
    } else {
      const executedResponse = await handleExecute(request, selectedClient)
      if (decryptedState && decryptedState === request.params.state_json && process.env.ENCRYPT_PAYLOAD_SLACK_APP === "true") {
        executedResponse.state = new Hub.ActionState()
        executedResponse.state.data = await this.encryptStateJson(decryptedState)
      }
      return executedResponse
    }
  }

  /**
   * Retrieves the form fields for the action.
   * Decrypts state_json before creating clients to fetch available workspaces.
   * If the response state needs to be maintained, it encrypts it before sending it back to Looker.
   */
  async form(request: Hub.ActionRequest) {
    const decryptedState = await this.decryptStateIfNeeded(request)
    const clientManager = new SlackClientManager(request, false, decryptedState)
    if (!clientManager.hasAnyClients()) {
      return this.loginForm(request)
    }
    const clients = clientManager.getClients()
    const form = new Hub.ActionForm()

    let client = clientManager.getSelectedClient()

    if (isSupportMultiWorkspaces(request) && clientManager.hasAnyClients()) {
      try {
        const authResponse = await this.authTest(clients)

        const defaultTeamId = request.formParams.workspace ? request.formParams.workspace : authResponse[0].team_id

        if (!client && defaultTeamId) {
          client = clientManager.getClient(defaultTeamId)
        }

        form.fields.push({
          description: "Name of the Slack workspace you would like to share in.",
          label: "Workspace",
          name: "workspace",
          options: authResponse.map((response) => ({name: response.team_id, label: response.team})),
          required: true,
          default: defaultTeamId,
          interactive: true,
          type: "select",
        })
      } catch (e: any) {
        winston.error(`${LOG_PREFIX} Failed to fetch workspace: ${e.message}`, {webhookId: request.webhookId})
      }
    }

    if (!client) {
      return this.loginForm(request, form)
    }

    const channelType = request.formParams.channelType ? request.formParams.channelType : "manual"

    try {
      form.fields = form.fields.concat(await getDisplayedFormFields(client, channelType))
    } catch (e: any) {
      winston.error(`${LOG_PREFIX} Displaying Form Fields: ${e.message}`, {webhookId: request.webhookId})
      return this.loginForm(request, form)
    }

    if (decryptedState && decryptedState === request.params.state_json && process.env.ENCRYPT_PAYLOAD_SLACK_APP === "true") {
      form.state = new Hub.ActionState()
      form.state.data = await this.encryptStateJson(decryptedState)
    }
    return form
  }

  async loginForm(request: Hub.ActionRequest, form: Hub.ActionForm = new Hub.ActionForm()) {
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
      winston.error(`${LOG_PREFIX} Illegal State: state_url is empty.`, {webhookId: request.webhookId})
      form.error = "Illegal State: state_url is empty."
    }
    return form
  }

  /**
   * Checks if the OAuth connection is valid.
   * Opportunistically decrypts the state and returns whether the connection holds.
   */
  async oauthCheck(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const decryptedState = await this.decryptStateIfNeeded(request)
    const clientManager = new SlackClientManager(request, false, decryptedState)
    if (!clientManager.hasAnyClients()) {
      form.error = AUTH_MESSAGE
      winston.error(`${LOG_PREFIX} ${AUTH_MESSAGE}`, {webhookId: request.webhookId})
      return form
    }
    try {
      const authResponse = await this.authTest(clientManager.getClients())

      const valFn = (resp: AuthTestResult) => isSupportMultiWorkspaces(request) ?
          JSON.stringify({ installation_id: resp.team_id, installation_name: resp.team }) :
          `Connected with ${resp.team} (${resp.team_id})`

      authResponse.forEach((resp) => {
        form.fields.push({
          name: "Connected",
          type: "message",
          value: valFn(resp),
        })
      })
    } catch (e: any) {
      form.error = displayError[e.message] || e
      winston.error(`${LOG_PREFIX} ${form.error}`, {webhookId: request.webhookId})
    }
    if (decryptedState && decryptedState === request.params.state_json && process.env.ENCRYPT_PAYLOAD_SLACK_APP === "true") {
      form.state = new Hub.ActionState()
      form.state.data = await this.encryptStateJson(decryptedState)
    }
    return form
  }

  async authTest(clients: WebClient[]) {
    const resp = await Promise.all(
        clients
            .map(async (client) => client.auth.test() as Promise<WebAPICallResult | Error>)
            .map(async (p) => p.catch((e) => e)),
    )

    const result = resp.filter((r) => !(r instanceof Error))
    if (resp.length > 0 && result.length === 0) {
      winston.error(`${LOG_PREFIX} Auth test: ${resp[0]}`)
      throw resp[0]
    }
    return result
  }
  /**
   * Decrypts the state_json parsing it as plain text if decryption fails.
   * This ensures backward compatibility with older, unencrypted states.
   */
  private async decryptStateIfNeeded(request: Hub.ActionRequest): Promise<string | undefined> {
    if (!request.params.state_json) {
      return undefined
    }
    try {
      const crypto = new AESTransitCrypto()
      return await crypto.decrypt(request.params.state_json)
    } catch (e: any) {
      winston.warn(`${LOG_PREFIX} Decryption failed, assuming plain text: ${e.message}`)
      return request.params.state_json
    }
  }

  /**
   * Encrypts the state_json string if the feature flag is enabled.
   * Returns the encrypted string or the original state if encryption fails or is disabled.
   */
  private async encryptStateJson(stateJson: string): Promise<string> {
    if (process.env.ENCRYPT_PAYLOAD_SLACK_APP === "true") {
      try {
        const crypto = new AESTransitCrypto()
        return await crypto.encrypt(stateJson)
      } catch (e: any) {
        winston.error(`${LOG_PREFIX} Encryption failed: ${e.message}`)
        return stateJson
      }
    }
    return stateJson
  }
}

Hub.addAction(new SlackAction())
