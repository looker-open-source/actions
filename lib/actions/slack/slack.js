"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackAction = void 0;
const winston = require("winston");
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
    }
    async execute(request) {
        const resp = new Hub.ActionResponse();
        const clientManager = new slack_client_manager_1.SlackClientManager(request, true);
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
            return await (0, utils_1.handleExecute)(request, selectedClient);
        }
    }
    async form(request) {
        const clientManager = new slack_client_manager_1.SlackClientManager(request, false);
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
    async oauthCheck(request) {
        const form = new Hub.ActionForm();
        const clientManager = new slack_client_manager_1.SlackClientManager(request);
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
}
exports.SlackAction = SlackAction;
Hub.addAction(new SlackAction());
