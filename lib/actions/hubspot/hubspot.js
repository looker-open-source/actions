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
exports.HubspotAction = exports.HubspotCalls = exports.HubspotTags = void 0;
const hubspot = require("@hubspot/api-client");
const semver = require("semver");
const util = require("util");
const winston = require("winston");
const Hub = require("../../hub");
const hubspot_error_1 = require("./hubspot_error");
var HubspotTags;
(function (HubspotTags) {
    HubspotTags["ContactId"] = "hubspot_contact_id";
    HubspotTags["CompanyId"] = "hubspot_company_id";
})(HubspotTags = exports.HubspotTags || (exports.HubspotTags = {}));
var HubspotCalls;
(function (HubspotCalls) {
    HubspotCalls["Contact"] = "contact";
    HubspotCalls["Company"] = "company";
})(HubspotCalls = exports.HubspotCalls || (exports.HubspotCalls = {}));
function delay(ms) {
    return __awaiter(this, void 0, void 0, function* () {
        // tslint continually complains about this function, not sure why
        // tslint:disable-next-line
        return new Promise((resolve) => setTimeout(resolve, ms));
    });
}
const HUBSPOT_BATCH_UPDATE_DEFAULT_LIMIT = 10;
const HUBSPOT_BATCH_UPDATE_ITERATION_DELAY_MS = 500;
class HubspotAction extends Hub.Action {
    constructor({ name, label, description, call, tag, }) {
        super();
        this.iconName = "hubspot/hubspot.png";
        this.params = [
            {
                description: "An api key for Hubspot.",
                label: "Hubspot API Key",
                name: "hubspot_api_key",
                required: true,
                sensitive: true,
            },
            {
                description: "The number of objects to batch update per call (defaulted to 10)",
                label: "Batch Update Size",
                name: "hubspot_batch_update_size",
                required: false,
                sensitive: false,
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.usesStreaming = true;
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [
            Hub.ActionVisualizationFormatting.Noapply,
        ];
        this.executeInOwnProcess = true;
        this.supportedFormats = (request) => {
            if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
                return [Hub.ActionFormat.JsonDetailLiteStream];
            }
            else {
                return [Hub.ActionFormat.JsonDetail];
            }
        };
        this.name = name;
        this.label = label;
        this.description = description;
        this.call = call;
        this.tag = tag;
        this.requiredFields = [{ any_tag: [tag] }];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeHubspot(request);
        });
    }
    hubspotClientFromRequest(request) {
        return new hubspot.Client({ apiKey: request.params.hubspot_api_key });
    }
    taggedFields(fields, tags) {
        return fields.filter((f) => f.tags &&
            f.tags.length > 0 &&
            f.tags.some((t) => tags.indexOf(t) !== -1));
    }
    getHubspotIdFieldName(fieldset) {
        let fieldName;
        fieldset.forEach((field) => {
            if (field.tags &&
                field.tags.length > 0 &&
                field.tags.includes(this.tag)) {
                fieldName = field.name;
            }
        });
        return fieldName;
    }
    /**
     * Returns the hubspot ID from the current row, given that one of the column dimensions
     * was tagged with the corresponding HubspotTag
     * @param fieldset Fieldset for the entire query
     * @param row The specific row to be processed
     */
    getHubspotIdFromRow(fieldset, row) {
        const hubspotIdFieldName = this.getHubspotIdFieldName(fieldset);
        if (!hubspotIdFieldName) {
            return undefined;
        }
        for (const field of fieldset) {
            if (field.name === hubspotIdFieldName) {
                return row[hubspotIdFieldName].value;
            }
        }
    }
    executeHubspot(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const hubspotClient = this.hubspotClientFromRequest(request);
            let hiddenFields = [];
            if (request.scheduledPlan &&
                request.scheduledPlan.query &&
                request.scheduledPlan.query.vis_config &&
                request.scheduledPlan.query.vis_config.hidden_fields) {
                hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields;
            }
            let hubspotIdFieldName;
            const batchUpdateObjects = [];
            let fieldset = [];
            const errors = [];
            try {
                yield request.streamJsonDetail({
                    onFields: (fields) => {
                        fieldset = Hub.allFields(fields);
                        hubspotIdFieldName = this.getHubspotIdFieldName(fieldset);
                        if (!hubspotIdFieldName) {
                            const error = `Dimension with the ${this.tag} tag is required`;
                            winston.error(error, request.webhookId);
                            throw new hubspot_error_1.HubspotActionError(error);
                        }
                    },
                    onRow: (row) => {
                        const hubspotId = this.getHubspotIdFromRow(fieldset, row);
                        if (hubspotId) {
                            const entries = Object.entries(row);
                            const properties = {};
                            entries.forEach(([fieldName, fieldSet]) => {
                                if (fieldName !== hubspotIdFieldName &&
                                    hiddenFields.indexOf(fieldName) === -1) {
                                    const safeFieldName = fieldName.replace(/\./g, "_");
                                    properties[safeFieldName] = fieldSet.value;
                                }
                            });
                            // Append id and properties to batch update
                            try {
                                batchUpdateObjects.push({
                                    id: hubspotId,
                                    properties,
                                });
                            }
                            catch (e) {
                                errors.push(e);
                            }
                        }
                    },
                });
                winston.info(`${batchUpdateObjects.length} total objects to update`);
                let hubspotBatchUpdateRequest;
                switch (this.call) {
                    case HubspotCalls.Contact:
                        hubspotBatchUpdateRequest = hubspotClient.crm.contacts.batchApi.update;
                        break;
                    case HubspotCalls.Company:
                        hubspotBatchUpdateRequest =
                            hubspotClient.crm.companies.batchApi.update;
                    default:
                        break;
                }
                if (hubspotBatchUpdateRequest) {
                    let limit = HUBSPOT_BATCH_UPDATE_DEFAULT_LIMIT;
                    if (request.params.hubspot_batch_update_size) {
                        limit = +request.params.hubspot_batch_update_size;
                    }
                    // Batching is restricted to HUBSPOT_BATCH_UPDATE_LMIT items at a time, and only 10 requests per second
                    // Loop through batches and await HUBSPOT_BATCH_UPDATE_ITERATION_DELAY_MS between requests
                    for (let i = 0; i < batchUpdateObjects.length; i += limit) {
                        const updateIteration = batchUpdateObjects.slice(i, i + limit);
                        try {
                            yield hubspotBatchUpdateRequest({
                                inputs: updateIteration,
                            });
                        }
                        catch (e) {
                            errors.push(e);
                        }
                        if (i < batchUpdateObjects.length - 1) {
                            yield delay(HUBSPOT_BATCH_UPDATE_ITERATION_DELAY_MS);
                        }
                    }
                }
                else {
                    const error = `Unable to determine a batch update request method for ${this.call}`;
                    winston.error(error, request.webhookId);
                    throw new hubspot_error_1.HubspotActionError(error);
                }
            }
            catch (e) {
                errors.push(e);
            }
            if (errors.length > 0) {
                let msg = errors.map((e) => (e.message ? e.message : e)).join(", ");
                if (msg.length === 0) {
                    msg = "An unknown error occurred while processing the Hubspot action.";
                    winston.warn(`Can't format Hubspot errors: ${util.inspect(errors)}`);
                }
                return new Hub.ActionResponse({ success: false, message: msg });
            }
            else {
                return new Hub.ActionResponse({ success: true });
            }
        });
    }
}
exports.HubspotAction = HubspotAction;
