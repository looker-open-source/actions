"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookAction = void 0;
const Hub = require("../../hub");
const req = require("request-promise-native");
const url_1 = require("url");
class WebhookAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.requiredFields = [];
        this.params = [];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.usesStreaming = true;
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
    }
    async execute(request) {
        if (!request.formParams.url) {
            throw "Missing url.";
        }
        if (!this.domain) {
            throw "Action requires a domain.";
        }
        const providedUrl = request.formParams.url;
        const parsedUrl = new url_1.URL(providedUrl);
        if (!parsedUrl.hostname) {
            throw "Incorrect domain for url.";
        }
        // don't enforce sub-domain, just domain and tld
        const domain = parsedUrl.hostname.split(".").slice(-2).join(".");
        if (!(domain === this.domain)) {
            throw "Incorrect domain for url.";
        }
        try {
            await request.stream(async (readable) => {
                return req.post({ uri: providedUrl, body: readable }).promise();
            });
            return new Hub.ActionResponse({ success: true });
        }
        catch (e) {
            return new Hub.ActionResponse({ success: false, message: e.message });
        }
    }
    async form() {
        const form = new Hub.ActionForm();
        form.fields = [{
                label: "Webhook URL",
                name: "url",
                required: true,
                type: "string",
            }];
        return form;
    }
}
exports.WebhookAction = WebhookAction;
