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
exports.MarketoAction = void 0;
const semver = require("semver");
const Hub = require("../../hub");
const marketo_transaction_1 = require("./marketo_transaction");
class MarketoAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "marketo";
        this.label = "Marketo";
        this.iconName = "marketo/marketo.svg";
        this.description = "Update Marketo leads and their campaign/list membership.";
        this.params = [
            {
                description: "Identity server host URL",
                label: "URL",
                name: "url",
                required: true,
                sensitive: false,
            },
            {
                description: "Client ID from Marketo",
                label: "Client ID",
                name: "clientID",
                required: true,
                sensitive: false,
            },
            {
                description: "Client Secret from Marketo",
                label: "Client Secret",
                name: "clientSecret",
                required: true,
                sensitive: true,
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.usesStreaming = true;
        this.executeInOwnProcess = true;
        this.supportedFormats = (request) => {
            if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
                return [Hub.ActionFormat.JsonDetailLiteStream];
            }
            else {
                return [Hub.ActionFormat.JsonDetail];
            }
        };
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            // create a stateful object to manage the transaction
            const transaction = new marketo_transaction_1.MarketoTransaction();
            // return the response from the transaction object
            return transaction.handleRequest(request);
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Lead Lookup Field",
                    name: "lookupField",
                    type: "string",
                    description: "Marketo field to use when looking up leads to update",
                    default: "email",
                    required: true,
                }, {
                    label: "Additional Action",
                    name: "subaction",
                    type: "select",
                    options: [
                        {
                            name: "addCampaign",
                            label: "Update lead and add to below Campaign ID",
                        }, {
                            name: "addList",
                            label: "Update lead and add to below List ID",
                        }, {
                            name: "removeList",
                            label: "Update lead and remove from below List ID",
                        },
                        {
                            name: "none",
                            label: "None - Update lead only",
                        },
                    ],
                    description: "Additional action to take",
                    default: "addCampaign",
                    required: true,
                }, {
                    label: "Campaign/List ID for Additional Action",
                    name: "campaignId",
                    // Named campaignId for backwards compatibility with older action, even though it may be
                    // either a campaignId or a listId
                    type: "string",
                    description: "Either a Campaign ID or a List ID, depending on above selection",
                    required: false,
                }];
            return form;
        });
    }
}
exports.MarketoAction = MarketoAction;
Hub.addAction(new MarketoAction());
