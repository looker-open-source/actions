"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackClientManager = exports.makeSlackClient = exports.isSupportMultiWorkspaces = exports.MULTI_WORKSPACE_SUPPORTED_VERSION = exports.PLACEHOLDER_WORKSPACE = void 0;
const web_api_1 = require("@slack/web-api");
const semver = require("semver");
const winston = require("winston");
exports.PLACEHOLDER_WORKSPACE = "any";
exports.MULTI_WORKSPACE_SUPPORTED_VERSION = "7.3.0";
const isSupportMultiWorkspaces = (request) => request.lookerVersion && semver.gte(request.lookerVersion, exports.MULTI_WORKSPACE_SUPPORTED_VERSION);
exports.isSupportMultiWorkspaces = isSupportMultiWorkspaces;
const makeSlackClient = (token, disableRetries = false) => {
    if (disableRetries) {
        return new web_api_1.WebClient(token, { retryConfig: { retries: 0 } });
    }
    else {
        return new web_api_1.WebClient(token);
    }
};
exports.makeSlackClient = makeSlackClient;
class SlackClientManager {
    constructor(request, disableRetries = false) {
        this.hasAnyClients = () => Object.entries(this.clients).length > 0;
        this.getClients = () => Object.values(this.clients);
        this.hasSelectedClient = () => !!this.selectedInstallId;
        this.getSelectedClient = () => this.selectedInstallId ?
            this.clients[this.selectedInstallId] : undefined;
        this.getClient = (installId) => this.clients[installId];
        const stateJson = request.params.state_json;
        if (!stateJson) {
            this.clients = {};
        }
        else {
            const supportMultiWs = request.lookerVersion && semver.gte(request.lookerVersion, exports.MULTI_WORKSPACE_SUPPORTED_VERSION);
            let json = stateJson;
            if (supportMultiWs) {
                try {
                    json = JSON.parse(stateJson);
                }
                catch (e) {
                    winston.warn("Received malform JSON for supported multi tenant version. Proceeding as str.");
                }
            }
            if (supportMultiWs && Array.isArray(json)) {
                this.clients = JSON.parse(stateJson)
                    .reduce((accumulator, stateJsonItem) => {
                    const ws = stateJsonItem.install_id;
                    if (stateJsonItem.token) {
                        accumulator[ws] = (0, exports.makeSlackClient)(stateJsonItem.token, disableRetries);
                    }
                    return accumulator;
                }, {});
                if (request.formParams.workspace) {
                    this.selectedInstallId = request.formParams.workspace;
                }
                else {
                    /**
                     * To fallback to the first client if there isn't any selected.
                     * This is to allow existing schedules to work without the user has to
                     * go back to the scheduler modal to select the workspace.
                     */
                    this.selectedInstallId = Object.keys(this.clients)[0];
                }
            }
            else {
                this.selectedInstallId = exports.PLACEHOLDER_WORKSPACE;
                this.clients = { [exports.PLACEHOLDER_WORKSPACE]: (0, exports.makeSlackClient)(stateJson, disableRetries) };
            }
        }
    }
}
exports.SlackClientManager = SlackClientManager;
