"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZapierAction = void 0;
const Hub = require("../../hub");
const webhook_1 = require("../webhook/webhook");
class ZapierAction extends webhook_1.WebhookAction {
    constructor() {
        super(...arguments);
        this.name = "zapier";
        this.label = "Zapier";
        this.iconName = "zapier/zapier.png";
        this.description = "Send data and begin a Zapier zap.";
        this.domain = "zapier.com";
    }
    async form() {
        const form = new Hub.ActionForm();
        form.fields = [{
                label: "Zapier Webhook URL",
                name: "url",
                required: true,
                type: "string",
            }];
        return form;
    }
}
exports.ZapierAction = ZapierAction;
Hub.addAction(new ZapierAction());
