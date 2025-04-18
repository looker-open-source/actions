"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackAttachmentAction = void 0;
const Hub = require("../../../hub");
const web_api_1 = require("@slack/web-api");
const utils_1 = require("../utils");
class SlackAttachmentAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "slack";
        this.label = "Slack Attachment (API Token)";
        this.iconName = "slack/legacy_slack/slack.png";
        this.description = "Write a data file to Slack using a bot user token or legacy API token.";
        this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard];
        this.requiredFields = [];
        this.params = [{
                name: "slack_api_token",
                label: "Slack API Token",
                required: true,
                description: `A Slack API token that includes the permissions "channels:read", \
"users:read", "groups:read", and "files:write:user". Follow the instructions to get a token at \
https://github.com/looker/actions/blob/master/src/actions/slack/legacy_slack/README.md`,
                sensitive: true,
            }];
        this.usesStreaming = false;
        this.executeInOwnProcess = true;
    }
    async execute(request) {
        return await (0, utils_1.handleExecute)(request, this.slackClientFromRequest(request, true));
    }
    async form(request) {
        const form = new Hub.ActionForm();
        const channelType = request.formParams.channelType ? request.formParams.channelType : "manual";
        try {
            form.fields = await (0, utils_1.getDisplayedFormFields)(this.slackClientFromRequest(request), channelType);
        }
        catch (e) {
            form.error = utils_1.displayError[e.message] || e;
        }
        return form;
    }
    slackClientFromRequest(request, disableRetries = false) {
        if (disableRetries) {
            return new web_api_1.WebClient(request.params.slack_api_token, { retryConfig: { retries: 0 } });
        }
        else {
            return new web_api_1.WebClient(request.params.slack_api_token);
        }
    }
}
exports.SlackAttachmentAction = SlackAttachmentAction;
Hub.addAction(new SlackAttachmentAction());
