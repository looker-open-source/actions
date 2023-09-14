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
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
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
                yield request.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                    return req.post({ uri: providedUrl, body: readable }).promise();
                }));
                return new Hub.ActionResponse({ success: true });
            }
            catch (e) {
                return new Hub.ActionResponse({ success: false, message: e.message });
            }
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Webhook URL",
                    name: "url",
                    required: true,
                    type: "string",
                }];
            return form;
        });
    }
}
exports.WebhookAction = WebhookAction;
