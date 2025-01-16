"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataRobotAction = void 0;
const normalizeUrl = require("normalize-url");
const httpRequest = require("request-promise-native");
const url_1 = require("url");
const Hub = require("../../hub");
class DataRobotAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "datarobot";
        this.label = "DataRobot - Create New Project";
        this.iconName = "datarobot/dr-head.svg";
        this.description = "Send data to DataRobot and create a new project.";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.Csv];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.requiredFields = [];
        this.usesStreaming = true;
        this.params = [
            {
                name: "datarobot_api_token",
                label: "Authentication User Attribute",
                description: `Select the customer user attribute that holds the DataRobot API Token.`,
                required: true,
                sensitive: true,
            },
            {
                name: "datarobot_url",
                label: "DataRobot URL",
                description: `Enter your DataRobot application URL. Example: https://app.datarobot.com.`,
                required: false,
                sensitive: false,
            },
        ];
        this.minimumSupportedLookerVersion = "5.24.0";
        this.dataRobotUrl = null;
    }
    async execute(request) {
        const options = {
            url: `${this.getDataRobotApiUrl()}/projects/`,
            headers: {
                Authorization: `Token ${request.params.datarobot_api_token}`,
            },
            body: {
                projectName: request.formParams.projectName,
                url: request.scheduledPlan && request.scheduledPlan.downloadUrl,
            },
            json: true,
            resolveWithFullResponse: true,
        };
        try {
            await httpRequest.post(options).promise();
            return new Hub.ActionResponse({ success: true });
        }
        catch (e) {
            return new Hub.ActionResponse({ success: false, message: e.message });
        }
    }
    async form(request) {
        const form = new Hub.ActionForm();
        if (!request.params.datarobot_api_token) {
            form.error = "No DataRobot API Token configured; consult your Looker admin.";
            return form;
        }
        if (request.params.datarobot_url) {
            try {
                const normalizedDataRobotUrl = normalizeUrl(request.params.datarobot_url);
                await httpRequest.get(normalizedDataRobotUrl).promise();
                this.dataRobotUrl = normalizedDataRobotUrl;
            }
            catch (_a) {
                form.error = "URL for on-premise instance is not valid.";
                return form;
            }
        }
        try {
            await this.validateDataRobotToken(request.params.datarobot_api_token);
            form.fields = [
                {
                    label: "The name of the project to be created",
                    name: "projectName",
                    required: false,
                    type: "string",
                },
            ];
        }
        catch (e) {
            form.error = this.prettyDataRobotError(e);
        }
        return form;
    }
    getDataRobotApiUrl() {
        if (this.dataRobotUrl) {
            return new url_1.URL("/api/v2", this.dataRobotUrl);
        }
        return "https://app.datarobot.com/api/v2";
    }
    async validateDataRobotToken(token) {
        try {
            // We don't have a specific endpoint to validate user-token,
            // so trying to get a list of projects instead
            await httpRequest.get({
                url: `${this.getDataRobotApiUrl()}/projects/`,
                headers: {
                    Authorization: `Token ${token}`,
                },
                json: true,
            }).promise();
        }
        catch (e) {
            throw new Error("Invalid token");
        }
    }
    prettyDataRobotError(e) {
        if (e.message === "Invalid token") {
            return "Your DataRobot API token is invalid.";
        }
        return e.message;
    }
}
exports.DataRobotAction = DataRobotAction;
Hub.addAction(new DataRobotAction());
