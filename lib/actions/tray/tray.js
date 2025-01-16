"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrayAction = void 0;
const Hub = require("../../hub");
const webhook_1 = require("../webhook/webhook");
class TrayAction extends webhook_1.WebhookAction {
    constructor() {
        super(...arguments);
        this.name = "tray";
        this.label = "Tray";
        this.iconName = "tray/tray.svg";
        this.description = "Send data and begin a Tray workflow.";
        this.domain = "trayapp.io";
    }
    async form() {
        const form = new Hub.ActionForm();
        form.fields = [{
                label: "Tray Webhook URL",
                name: "url",
                required: true,
                type: "string",
            }];
        return form;
    }
}
exports.TrayAction = TrayAction;
Hub.addAction(new TrayAction());
