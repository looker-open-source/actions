"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackAction = void 0;
const winston = require("winston");
const aes_transit_crypto_1 = require("../../crypto/aes_transit_crypto");
const http_errors_1 = require("../../error_types/http_errors");
const Hub = require("../../hub");
const action_response_1 = require("../../hub/action_response");
const slack_client_manager_1 = require("./slack_client_manager");
const utils_1 = require("./utils");
const AUTH_MESSAGE = "You must connect to a Slack workspace first.";
const LOG_PREFIX = "[SLACK]";
class SlackAction extends Hub.DelegateOAuthAction {
    constructor() {
        super(...arguments);
        this.name = "slack_app";
        this.label = "Slack";
        this.iconName = "slack/slack.png";
        this.description = "Explore and share Looker content in Slack.";
        this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard];
        this.requiredFields = [];
        this.params = [{
                name: "install",
                label: "Connect to Slack",
                delegate_oauth_url: "/admin/integrations/slack/install",
                required: false,
                sensitive: false,
                description: `View dashboards and looks,
     browse your favorites or folders, and interact with Looker content without leaving Slack.`,
            }];
        this.minimumSupportedLookerVersion = "6.23.0";
        this.usesStreaming = true;
        this.executeInOwnProcess = true;
        this.crypto = new aes_transit_crypto_1.AESTransitCrypto();
    }
    /**
     * Executes the Slack action.
     * Decrypts state_json if it was previously encrypted and passes it to the client manager.
     * If execution succeeds and the feature flag is on, it encrypts the state before returning.
     */
    async execute(request) {
        const resp = new Hub.ActionResponse();
        const decryptedState = await this.decryptStateIfNeeded(request);
        const clientManager = new slack_client_manager_1.SlackClientManager(request, true, decryptedState);
        const selectedClient = clientManager.getSelectedClient();
        if (!selectedClient) {
            const error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} Missing client`);
            resp.error = error;
            resp.message = error.message;
            resp.webhookId = request.webhookId;
            resp.success = false;
            winston.error(`${error.message}`, { error, webhookId: request.webhookId });
            return resp;
        }
        else {
            const executedResponse = await (0, utils_1.handleExecute)(request, selectedClient);
            await this.updateStateIfNeeded(executedResponse, decryptedState, request.params.state_json, request.webhookId);
            return executedResponse;
        }
    }
    /**
     * Retrieves the form fields for the action.
     * Decrypts state_json before creating clients to fetch available workspaces.
     * If the response state needs to be maintained, it encrypts it before sending it back to Looker.
     */
    async form(request) {
        const decryptedState = await this.decryptStateIfNeeded(request);
        const clientManager = new slack_client_manager_1.SlackClientManager(request, false, decryptedState);
        if (!clientManager.hasAnyClients()) {
            return this.loginForm(request);
        }
        const clients = clientManager.getClients();
        const form = new Hub.ActionForm();
        let client = clientManager.getSelectedClient();
        if ((0, slack_client_manager_1.isSupportMultiWorkspaces)(request) && clientManager.hasAnyClients()) {
            try {
                const authResponse = await this.authTest(clients);
                const defaultTeamId = request.formParams.workspace ? request.formParams.workspace : authResponse[0].team_id;
                if (!client && defaultTeamId) {
                    client = clientManager.getClient(defaultTeamId);
                }
                form.fields.push({
                    description: "Name of the Slack workspace you would like to share in.",
                    label: "Workspace",
                    name: "workspace",
                    options: authResponse.map((response) => ({ name: response.team_id, label: response.team })),
                    required: true,
                    default: defaultTeamId,
                    interactive: true,
                    type: "select",
                });
            }
            catch (e) {
                winston.error(`${LOG_PREFIX} Failed to fetch workspace: ${e.message}`, { webhookId: request.webhookId });
            }
        }
        if (!client) {
            return this.loginForm(request, form);
        }
        const channelType = request.formParams.channelType ? request.formParams.channelType : "manual";
        try {
            form.fields = form.fields.concat(await (0, utils_1.getDisplayedFormFields)(client, channelType));
        }
        catch (e) {
            winston.error(`${LOG_PREFIX} Displaying Form Fields: ${e.message}`, { webhookId: request.webhookId });
            return this.loginForm(request, form);
        }
        await this.updateStateIfNeeded(form, decryptedState, request.params.state_json, request.webhookId);
        return form;
    }
    async loginForm(request, form = new Hub.ActionForm()) {
        const oauthUrl = request.params.state_url;
        if (oauthUrl) {
            form.state = new Hub.ActionState();
            form.fields.push({
                name: "login",
                type: "oauth_link",
                label: "Log in",
                description: "In order to send to a file, you will need to log in to your Slack account.",
                oauth_url: oauthUrl,
            });
        }
        else {
            winston.error(`${LOG_PREFIX} Illegal State: state_url is empty.`, { webhookId: request.webhookId });
            form.error = "Illegal State: state_url is empty.";
        }
        return form;
    }
    /**
     * Checks if the OAuth connection is valid.
     * Opportunistically decrypts the state and returns whether the connection holds.
     */
    async oauthCheck(request) {
        const form = new Hub.ActionForm();
        const decryptedState = await this.decryptStateIfNeeded(request);
        const clientManager = new slack_client_manager_1.SlackClientManager(request, false, decryptedState);
        if (!clientManager.hasAnyClients()) {
            form.error = AUTH_MESSAGE;
            winston.error(`${LOG_PREFIX} ${AUTH_MESSAGE}`, { webhookId: request.webhookId });
            return form;
        }
        try {
            const authResponse = await this.authTest(clientManager.getClients());
            const valFn = (resp) => (0, slack_client_manager_1.isSupportMultiWorkspaces)(request) ?
                JSON.stringify({ installation_id: resp.team_id, installation_name: resp.team }) :
                `Connected with ${resp.team} (${resp.team_id})`;
            authResponse.forEach((resp) => {
                form.fields.push({
                    name: "Connected",
                    type: "message",
                    value: valFn(resp),
                });
            });
        }
        catch (e) {
            form.error = utils_1.displayError[e.message] || e;
            winston.error(`${LOG_PREFIX} ${form.error}`, { webhookId: request.webhookId });
        }
        await this.updateStateIfNeeded(form, decryptedState, request.params.state_json, request.webhookId);
        return form;
    }
    async authTest(clients) {
        const resp = await Promise.all(clients
            .map(async (client) => client.auth.test())
            .map(async (p) => p.catch((e) => e)));
        const result = resp.filter((r) => !(r instanceof Error));
        if (resp.length > 0 && result.length === 0) {
            winston.error(`${LOG_PREFIX} Auth test: ${resp[0]}`);
            throw resp[0];
        }
        return result;
    }
    /**
     * Re-encrypts the state_json if it was decrypted successfully and the feature flag is on.
     */
    async updateStateIfNeeded(response, decryptedState, originalState, webhookId = undefined) {
        if (decryptedState && decryptedState === originalState && process.env.ENCRYPT_PAYLOAD_SLACK_APP === "true") {
            response.state = new Hub.ActionState();
            response.state.data = await this.encryptStateJson(decryptedState, webhookId);
        }
    }
    /**
     * Decrypts the state_json parsing it as plain text if decryption fails.
     * This ensures backward compatibility with older, unencrypted states.
     */
    async decryptStateIfNeeded(request) {
        if (!request.params.state_json) {
            return undefined;
        }
        try {
            const parsed = JSON.parse(request.params.state_json);
            if (parsed.cid && parsed.payload) {
                winston.info("Extracting encrypted state_json", { webhookId: request.webhookId, action: this.name });
                return await this.crypto.decrypt(parsed.payload);
            }
        }
        catch (e) {
            winston.info("Extracting unencrypted state_json", { webhookId: request.webhookId, action: this.name });
            return request.params.state_json;
        }
        winston.info("Extracting unencrypted state_json", { webhookId: request.webhookId, action: this.name });
        return request.params.state_json;
    }
    /**
     * Encrypts the state_json string if the feature flag is enabled.
     * Returns the encrypted string or the original state if encryption fails or is disabled.
     */
    async encryptStateJson(stateJson, webhookId) {
        if (process.env.ENCRYPT_PAYLOAD_SLACK_APP === "true") {
            try {
                const encrypted = await this.crypto.encrypt(stateJson);
                const payload = {
                    cid: "1",
                    payload: encrypted,
                };
                return JSON.stringify(payload);
            }
            catch (e) {
                winston.error(`${LOG_PREFIX} Encryption failed: ${e.message}`, { webhookId, action: this.name });
                return stateJson;
            }
        }
        return stateJson;
    }
}
exports.SlackAction = SlackAction;
Hub.addAction(new SlackAction());
