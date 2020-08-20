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
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Tray Webhook URL",
                    name: "url",
                    required: true,
                    type: "string",
                }];
            return form;
        });
    }
}
exports.TrayAction = TrayAction;
Hub.addAction(new TrayAction());
