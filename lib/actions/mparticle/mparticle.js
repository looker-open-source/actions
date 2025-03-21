"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MparticleAction = void 0;
const semver = require("semver");
const Hub = require("../../hub");
const mparticle_transaction_1 = require("./mparticle_transaction");
class MparticleAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "mparticle";
        this.label = "mParticle";
        this.iconName = "mparticle/mparticle.svg";
        this.description = "Send user or event data from Looker to mParticle.";
        this.params = [
            {
                description: "API Key for mParticle",
                label: "API Key",
                name: "apiKey",
                required: true,
                sensitive: false,
            },
            {
                description: "API Secret for mParticle",
                label: "API Secret",
                name: "apiSecret",
                required: true,
                sensitive: true,
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.usesStreaming = true;
        this.executeInOwnProcess = true;
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.supportedFormats = (request) => {
            if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
                return [Hub.ActionFormat.JsonDetailLiteStream];
            }
            else {
                return [Hub.ActionFormat.JsonDetail];
            }
        };
    }
    async execute(request) {
        // create a stateful object to manage the transaction
        const transaction = new mparticle_transaction_1.MparticleTransaction();
        // return the response from the transaction object
        return transaction.handleRequest(request);
    }
    async form() {
        const form = new Hub.ActionForm();
        form.fields = [
            {
                label: "Data Type",
                name: "data_type",
                description: "Specify data type: User Profiles or Events",
                required: true,
                options: [
                    { name: "user_data", label: "User Profiles" },
                    { name: "event_data", label: "Events" },
                ],
                type: "select",
            },
            {
                label: "Environment",
                name: "environment",
                description: "Specify environment to send to: Test/Development or Production",
                required: true,
                options: [
                    { name: "production", label: "Production" },
                    { name: "development", label: "Test/Development" },
                ],
                type: "select",
            },
        ];
        return form;
    }
}
exports.MparticleAction = MparticleAction;
Hub.addAction(new MparticleAction());
