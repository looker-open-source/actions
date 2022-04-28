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
exports.BrazeAction = void 0;
const req = require("request-promise-native");
const url_1 = require("url");
const Hub = require("../../hub");
var BrazeConfig;
(function (BrazeConfig) {
    BrazeConfig["EXPORT_PATH"] = "/users/track";
    BrazeConfig["LOOKER_ATTRIBUTE_NAME"] = "looker_export";
    BrazeConfig[BrazeConfig["MAX_LINES"] = 75] = "MAX_LINES";
    BrazeConfig["BRAZE_ID_TAG"] = "braze_id";
    BrazeConfig["BRAZE_ATTRIBUTE_REGEX"] = "(?<=braze\\[)(.*)(?=\\])";
    BrazeConfig["EXPORT_DEFAULT_VALUE"] = "LOOKER_EXPORT";
    BrazeConfig[BrazeConfig["MAX_EXPORT"] = 100000] = "MAX_EXPORT";
    BrazeConfig["DEFAULT_DOMAIN_REGEX"] = "^https?://(.*)\\.braze\\.(com|eu)$";
})(BrazeConfig || (BrazeConfig = {}));
function isEmpty(obj) {
    return !obj || Object.keys(obj).length === 0;
}
class BrazeAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "braze";
        this.label = "Braze";
        this.description = "Flags users from Looker to Braze via the REST API for use with segmentation. "
            + "Ensure there's a '" + BrazeConfig.BRAZE_ID_TAG + "' field tagged in the results."
            + " MAX EXPORT: " + BrazeConfig.MAX_EXPORT + ".";
        this.iconName = "braze/braze.svg";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.requiredFields = [{ tag: String(BrazeConfig.BRAZE_ID_TAG) }];
        this.usesStreaming = true;
        this.executeInOwnProcess = true;
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
        this.params = [{
                name: "braze_description",
                label: "Braze Description",
                required: false,
                sensitive: false,
                description: "Braze Action Description",
            },
            {
                name: "braze_api_key",
                label: "Braze API Key",
                required: true,
                sensitive: true,
                description: "Braze API Key from " +
                    "https://dashboard.braze.com/app_settings/developer_console/ with users.track permission.",
            },
            {
                name: "braze_api_endpoint",
                label: "Braze REST API Endpoint",
                required: true,
                sensitive: false,
                description: "Braze REST API endpoint based on the instance location. " +
                    "See: https://www.braze.com/docs/developer_guide/rest_api/basics/#endpoints" +
                    " Example: https://rest.iad-01.braze.com",
            }];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check for missing fields
            if (isEmpty(request.params)) {
                throw "Missing config settings.";
            }
            if (!(request.params.braze_api_endpoint)) {
                throw "Missing Endpoint.";
            }
            // Generate endpoint
            const endpoint = request.params.braze_api_endpoint.trim()
                .replace("http://", "https://").replace(/\/$/, "") + BrazeConfig.EXPORT_PATH;
            if (!endpoint.startsWith("http")) {
                throw "Missing Protocol for endpoint.";
            }
            const bzDomainRegex = new RegExp(BrazeConfig.DEFAULT_DOMAIN_REGEX, "gi");
            if (!(request.params.braze_api_endpoint.toLowerCase().match(bzDomainRegex))) {
                throw "Bad Endpoint.";
            }
            if (!request.params.braze_api_key) {
                throw "Missing API Key.";
            }
            if (!(request.formParams.braze_key)) {
                throw "Missing primary Braze key.";
            }
            const exportValue = request.formParams.braze_segment || String(BrazeConfig.EXPORT_DEFAULT_VALUE);
            const brazeAttribute = { add: [exportValue] };
            const brazeApiKey = String(request.params.braze_api_key);
            let totalCount = 0;
            let fieldlist = [];
            let bzIdField = "";
            const bzAttributeFields = [];
            let rows = [];
            const bzRegExp = new RegExp(BrazeConfig.BRAZE_ATTRIBUTE_REGEX, "gi");
            try {
                yield request.streamJsonDetail({
                    onFields: (fields) => {
                        fieldlist = Hub.allFields(fields);
                        for (const field of fieldlist) {
                            if (!field.tags) {
                                continue;
                            }
                            if (field.tags.find((tag) => tag === BrazeConfig.BRAZE_ID_TAG)) {
                                bzIdField = field.name;
                            }
                            for (const tag of field.tags) {
                                const bzTagMatches = tag.match(bzRegExp);
                                if (bzTagMatches) {
                                    bzAttributeFields.push([bzTagMatches[0], field.name]);
                                }
                            }
                        }
                        if (!bzIdField) {
                            throw "Primary Braze key not found.";
                        }
                    },
                    onRow: (row) => {
                        if (totalCount < BrazeConfig.MAX_EXPORT) {
                            const entry = {
                                _update_existing_only: true,
                            };
                            entry[String(request.formParams.braze_key)] = row[bzIdField].value;
                            for (const bzAttribute of bzAttributeFields) {
                                entry[bzAttribute[0]] = row[bzAttribute[1]].value;
                            }
                            entry[String(BrazeConfig.LOOKER_ATTRIBUTE_NAME)] = brazeAttribute;
                            rows.push(entry);
                            totalCount++;
                            if (rows.length === BrazeConfig.MAX_LINES) {
                                this.sendChunk(endpoint, brazeApiKey, rows)
                                    .catch((e) => {
                                    return new Hub.ActionResponse({ success: false, message: e.message });
                                });
                                rows = [];
                            }
                        }
                        else if (rows.length > 0) {
                            this.sendChunk(endpoint, brazeApiKey, rows)
                                .catch((e) => {
                                return new Hub.ActionResponse({ success: false, message: e.message });
                            });
                            rows = [];
                        }
                    },
                });
                if (rows.length > 0) {
                    yield this.sendChunk(endpoint, brazeApiKey, rows)
                        .catch((e) => {
                        return new Hub.ActionResponse({ success: false, message: e.message });
                    });
                    rows = [];
                }
            }
            catch (e) {
                return new Hub.ActionResponse({ success: false, message: e.message });
            }
            return new Hub.ActionResponse({ success: true, message: "ok" });
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Unique Key",
                    name: "braze_key",
                    description: " Primay key for user to map to within Braze.",
                    required: true,
                    options: [
                        { name: "external_id", label: "external_id" },
                        { name: "braze_id", label: "braze_id" },
                    ],
                    type: "select",
                    default: "external_id",
                }, {
                    label: "Export Label",
                    name: "braze_segment",
                    description: "Name of export (Appends to Custom Attribute Array '" +
                        BrazeConfig.LOOKER_ATTRIBUTE_NAME + "'). Defaults to '" + BrazeConfig.EXPORT_DEFAULT_VALUE + "'.",
                    required: true,
                    type: "string",
                    default: String(BrazeConfig.EXPORT_DEFAULT_VALUE),
                },
            ];
            return form;
        });
    }
    sendChunk(endpoint, apiKey, chunk) {
        return __awaiter(this, void 0, void 0, function* () {
            const urlendpoint = new url_1.URL(endpoint).toString();
            const reqbody = {
                attributes: chunk,
            };
            yield req.post({
                uri: urlendpoint, headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + apiKey,
                },
                body: reqbody, json: true
            }).promise();
        });
    }
}
exports.BrazeAction = BrazeAction;
Hub.addAction(new BrazeAction());
