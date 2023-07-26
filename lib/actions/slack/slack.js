"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackAction = void 0;
const winston = require("winston");
const Hub = require("../../hub");
const slack_client_manager_1 = require("./slack_client_manager");
const utils_1 = require("./utils");
const AUTH_MESSAGE = "You must connect to a Slack workspace first.";
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
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const clientManager = new slack_client_manager_1.SlackClientManager(request, true);
            const selectedClient = clientManager.getSelectedClient();
            if (!selectedClient) {
                return new Hub.ActionResponse({ success: false, message: AUTH_MESSAGE });
            }
            else {
                return yield (0, utils_1.handleExecute)(request, selectedClient);
            }
        });
    }
    form(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const clientManager = new slack_client_manager_1.SlackClientManager(request, false);
            if (!clientManager.hasAnyClients()) {
                return this.loginForm(request);
            }
            const clients = clientManager.getClients();
            const form = new Hub.ActionForm();
            let client = clientManager.getSelectedClient();
            if ((0, slack_client_manager_1.isSupportMultiWorkspaces)(request) && clientManager.hasAnyClients()) {
                try {
                    const authResponse = yield this.authTest(clients);
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
                    winston.error("Failed to fetch workspace: " + e.message);
                }
            }
            if (!client) {
                return this.loginForm(request, form);
            }
            const channelType = request.formParams.channelType ? request.formParams.channelType : "manual";
            try {
                form.fields = form.fields.concat(yield (0, utils_1.getDisplayedFormFields)(client, channelType));
            }
            catch (e) {
                return this.loginForm(request, form);
            }
            return form;
        });
    }
    loginForm(request, form = new Hub.ActionForm()) {
        return __awaiter(this, void 0, void 0, function* () {
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
                form.error = "Illegal State: state_url is empty.";
            }
            return form;
        });
    }
    oauthCheck(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            const clientManager = new slack_client_manager_1.SlackClientManager(request);
            if (!clientManager.hasAnyClients()) {
                form.error = AUTH_MESSAGE;
                return form;
            }
            try {
                const authResponse = yield this.authTest(clientManager.getClients());
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
            }
            return form;
        });
    }
    authTest(clients) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield Promise.all(clients
                .map((client) => __awaiter(this, void 0, void 0, function* () { return client.auth.test(); }))
                .map((p) => __awaiter(this, void 0, void 0, function* () { return p.catch((e) => e); })));
            const result = resp.filter((r) => !(r instanceof Error));
            if (resp.length > 0 && result.length === 0) {
                throw resp[0];
            }
            return result;
        });
    }
}
exports.SlackAction = SlackAction;
Hub.addAction(new SlackAction());
