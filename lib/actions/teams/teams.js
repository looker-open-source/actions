"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeamsAction = void 0;
const httpRequest = require("request-promise-native");
const winston = require("winston");
const Hub = require("../../hub");
class TeamsAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "teams_incomingwebhook";
        this.label = "Teams - Incoming Webhook";
        this.iconName = "teams/teams.png";
        this.description = "Send data to Teams Incoming webhook";
        this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard];
        this.supportedFormats = [Hub.ActionFormat.Csv, Hub.ActionFormat.WysiwygPng, Hub.ActionFormat.WysiwygPdf];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [
            Hub.ActionVisualizationFormatting.Noapply,
        ];
        this.params = [];
    }
    async execute(req) {
        var _a, _b;
        let response = { success: true, message: "success" };
        if (!req.formParams.webhookUrl) {
            throw new Error("Teams Error: Need a webhookUrl");
        }
        if (!req.formParams.title) {
            throw new Error("Teams Error: Need a title");
        }
        if (!req.formParams.isAttached) {
            throw new Error("Teams Error: Need a attach flag");
        }
        if (!req.scheduledPlan) {
            throw new Error("Teams Error: Couldn't get data from scheduledPlan");
        }
        const webhookUrl = req.formParams.webhookUrl;
        const title = req.formParams.title;
        const text = req.formParams.text === undefined
            ? ""
            : req.formParams.text.replace(/\n/g, "\n\n");
        const resCard = {
            type: "message",
            attachments: [
                {
                    contentType: "application/vnd.microsoft.card.adaptive",
                    contentUrl: null,
                    content: {
                        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                        type: "AdaptiveCard",
                        version: "1.2",
                        body: [
                            {
                                type: "TextBlock",
                                text: title,
                                weight: "bolder",
                                size: "medium",
                            },
                            {
                                type: "TextBlock",
                                text: text,
                                wrap: true,
                            },
                            {
                                type: "Image",
                                url: `data:image/png;base64,${((_b = (_a = req.attachment) === null || _a === void 0 ? void 0 : _a.dataBuffer) === null || _b === void 0 ? void 0 : _b.toString("base64")) || ""}`,
                                msTeams: {
                                    allowExpand: true,
                                },
                            },
                            {
                                type: "TextBlock",
                                text: "Type: " + (req.scheduledPlan.type || ""),
                                weight: "bolder",
                            },
                            {
                                type: "TextBlock",
                                text: "Title: " + title,
                                weight: "bolder",
                            },
                        ],
                        actions: [
                            {
                                type: "Action.OpenUrl",
                                title: "View this Dashboard in Looker",
                                url: req.scheduledPlan.url,
                            },
                        ],
                    },
                },
            ],
        };
        if (req.formParams.isAttached === "true") {
            const facts = [];
            facts.push({
                name: "Type :",
                value: req.scheduledPlan.type,
            });
            facts.push({
                name: "Title :",
                value: req.scheduledPlan.title,
            });
            if (req.type === Hub.ActionType.Query && req.scheduledPlan.query) {
                facts.push({
                    name: "Model :",
                    value: req.scheduledPlan.query.model,
                });
                facts.push({
                    name: "View :",
                    value: req.scheduledPlan.query.view,
                });
            }
            resCard.attachments[0].content.body.push({
                type: "FactSet",
                facts: facts.map(f => ({ title: f.name, value: f.value })),
            });
        }
        const option = {
            url: webhookUrl,
            json: resCard,
        };
        try {
            const result = await httpRequest.post(option).promise();
            if (result !== 1) {
                throw new Error(`Teams Error: ${result}`);
            }
        }
        catch (e) {
            response = { success: false, message: e.message };
            winston.error(`Teams Error: ${e.message}`);
        }
        return new Hub.ActionResponse(response);
    }
    async form() {
        const form = new Hub.ActionForm();
        form.fields = [];
        form.fields.push({
            label: "Webhook URL",
            name: "webhookUrl",
            required: true,
            type: "string",
        });
        form.fields.push({
            label: "Title",
            name: "title",
            required: true,
            type: "string",
        });
        form.fields.push({
            label: "Text",
            name: "text",
            required: false,
            type: "textarea",
        });
        form.fields.push({
            label: "Attach Meta Data",
            description: "attach meta data(type,title,model,view)",
            default: "false",
            name: "isAttached",
            required: false,
            type: "select",
            options: [
                { name: "false", label: "false" },
                { name: "true", label: "true" },
            ],
        });
        return form;
    }
}
exports.TeamsAction = TeamsAction;
Hub.addAction(new TeamsAction());
