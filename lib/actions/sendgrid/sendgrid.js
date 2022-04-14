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
exports.SendGridAction = void 0;
const Hub = require("../../hub");
const helpers = require("@sendgrid/helpers");
const sendgridMail = require("@sendgrid/mail");
class SendGridAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "sendgrid";
        this.label = "SendGrid";
        this.iconName = "sendgrid/sendgrid.png";
        this.description = "Send data files to an email via SendGrid.";
        this.params = [
            {
                description: "API key for SendGrid from https://app.sendgrid.com/settings/api_keys.",
                label: "SendGrid API Key",
                name: "sendgrid_api_key",
                required: true,
                sensitive: true,
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!request.attachment || !request.attachment.dataBuffer) {
                throw "Couldn't get data from attachment.";
            }
            if (!request.formParams.to) {
                throw "Needs a valid email address.";
            }
            const filename = request.formParams.filename || request.suggestedFilename();
            const plan = request.scheduledPlan;
            const subject = request.formParams.subject || (plan && plan.title ? plan.title : "Looker");
            const from = request.formParams.from ? request.formParams.from : "Looker <noreply@lookermail.com>";
            const msg = new helpers.classes.Mail({
                to: request.formParams.to,
                subject,
                from,
                text: plan && plan.url ?
                    `View this data in Looker. ${plan.url}\n Results are attached.`
                    :
                        "Results are attached.",
                html: plan && plan.url ?
                    `<p><a href="${plan.url}">View this data in Looker.</a></p><p>Results are attached.</p>`
                    :
                        "Results are attached.",
                attachments: [{
                        content: request.attachment.dataBuffer.toString(request.attachment.encoding),
                        filename,
                    }],
            });
            let response;
            try {
                yield this.sendEmail(request, msg);
            }
            catch (e) {
                response = { success: false, message: e.message };
            }
            return new Hub.ActionResponse(response);
        });
    }
    sendEmail(request, msg) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.sgMailClientFromRequest(request);
            return yield client.send(msg);
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    name: "to",
                    label: "To Email Address",
                    description: "e.g. test@example.com",
                    type: "string",
                    required: true,
                }, {
                    name: "from",
                    label: "From Email Address",
                    description: "e.g. test@example.com",
                    type: "string",
                }, {
                    label: "Filename",
                    name: "filename",
                    type: "string",
                }, {
                    label: "Subject",
                    name: "subject",
                    type: "string",
                }];
            return form;
        });
    }
    sgMailClientFromRequest(request) {
        sendgridMail.setApiKey(request.params.sendgrid_api_key);
        return sendgridMail;
    }
}
exports.SendGridAction = SendGridAction;
Hub.addAction(new SendGridAction());
