"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendGridAction = void 0;
const winston = require("winston");
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
    async execute(request) {
        const response = new Hub.ActionResponse();
        if (!request.attachment || !request.attachment.dataBuffer) {
            response.success = false;
            response.message = "Error: could not retrieve data from attachment, or attachment does not exist";
            winston.error(`Failed execute for sendgrid. ${response.message}`);
            return response;
        }
        if (!request.formParams.to) {
            response.success = false;
            response.message = "Error: invalid email address";
            winston.error(`Failed execute for sendgrid. ${response.message}`);
            return response;
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
        try {
            await this.sendEmail(request, msg);
            response.success = true;
        }
        catch (e) {
            response.success = false;
            response.message = `Error: ${e.message}`;
            if (e.response) {
                winston.error(`Failed execute for sendgrid with status code: ${e.response.status}`);
            }
        }
        return response;
    }
    async sendEmail(request, msg) {
        const client = this.sgMailClientFromRequest(request);
        return await client.send(msg);
    }
    async form() {
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
    }
    sgMailClientFromRequest(request) {
        sendgridMail.setApiKey(request.params.sendgrid_api_key);
        return sendgridMail;
    }
}
exports.SendGridAction = SendGridAction;
const sendGridAction = new SendGridAction();
Hub.addUnfilteredAction(sendGridAction);
Hub.addAction(sendGridAction);
