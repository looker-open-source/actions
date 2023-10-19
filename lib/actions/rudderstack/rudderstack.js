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
exports.RudderAction = exports.RudderCalls = exports.RudderTags = void 0;
const semver = require("semver");
const util = require("util");
const uuid = require("uuid");
const winston = require("winston");
const Hub = require("../../hub");
const rudderstack_error_1 = require("./rudderstack_error");
const rudder_sdk_node_1 = require("@rudderstack/rudder-sdk-node");
var RudderTags;
(function (RudderTags) {
    RudderTags["UserId"] = "user_id";
    RudderTags["RudderAnonymousId"] = "rudder_anonymous_id";
    RudderTags["Email"] = "email";
    RudderTags["RudderGroupId"] = "rudder_group_id";
})(RudderTags = exports.RudderTags || (exports.RudderTags = {}));
var RudderCalls;
(function (RudderCalls) {
    RudderCalls["Identify"] = "identify";
    RudderCalls["Track"] = "track";
    RudderCalls["Group"] = "group";
})(RudderCalls = exports.RudderCalls || (exports.RudderCalls = {}));
class RudderAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.allowedTags = [
            RudderTags.Email,
            RudderTags.UserId,
            RudderTags.RudderAnonymousId,
        ];
        this.name = "rudder_event";
        this.label = "Rudder Identify";
        this.iconName = "rudderstack/rudderstack.png";
        this.description = "Add traits via identify to your Rudder users.";
        this.params = [
            {
                description: "Looker source write key for Rudder.",
                label: "Rudder Write Key",
                name: "rudder_write_key",
                required: true,
                sensitive: true,
            },
            {
                description: "Give your Rudder server URL",
                label: "Rudder Data Plane URL",
                name: "rudder_server_url",
                required: true,
                sensitive: false,
            },
        ];
        this.minimumSupportedLookerVersion = "4.20.0";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.usesStreaming = true;
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [
            Hub.ActionVisualizationFormatting.Noapply,
        ];
        this.requiredFields = [{ any_tag: this.allowedTags }];
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
            return this.executeRudder(request, RudderCalls.Identify);
        });
    }
    executeRudder(request, rudderCall) {
        return __awaiter(this, void 0, void 0, function* () {
            const rudderClient = this.rudderClientFromRequest(request);
            let hiddenFields = [];
            if (request.scheduledPlan &&
                request.scheduledPlan.query &&
                request.scheduledPlan.query.vis_config &&
                request.scheduledPlan.query.vis_config.hidden_fields) {
                hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields;
            }
            let rudderFields;
            let fieldset = [];
            const errors = [];
            let timestamp = new Date();
            const context = {
                app: {
                    name: "looker/actions",
                    version: process.env.APP_VERSION ? process.env.APP_VERSION : "dev",
                },
            };
            const event = request.formParams.event;
            try {
                let totalRows = 0;
                const totalRequestsCompleted = 0;
                yield request.streamJsonDetail({
                    onFields: (fields) => {
                        fieldset = Hub.allFields(fields);
                        rudderFields = this.rudderFields(fieldset);
                        winston.debug(`[Rudder] fieldset :  ${JSON.stringify(fieldset)}`);
                        winston.debug(`[Rudder] RudderFields : ${JSON.stringify(rudderFields)}`);
                        this.unassignedRudderFieldsCheck(rudderFields);
                    },
                    onRanAt: (iso8601string) => {
                        if (iso8601string) {
                            timestamp = new Date(iso8601string);
                        }
                    },
                    onRow: (row) => {
                        totalRows = totalRows + 1;
                        winston.debug(`[Rudder] row : ${JSON.stringify(row)}`);
                        this.unassignedRudderFieldsCheck(rudderFields);
                        const payload = Object.assign(Object.assign({}, this.prepareRudderTraitsFromRow(row, fieldset, rudderFields, hiddenFields, rudderCall === RudderCalls.Track)), { event, context, timestamp });
                        if (payload.groupId === null) {
                            delete payload.groupId;
                        }
                        if (!payload.event) {
                            delete payload.event;
                        }
                        try {
                            winston.debug("===calling analytics api===");
                            rudderClient[rudderCall](payload /*, () => {
                            totalRequestsCompleted = totalRequestsCompleted + 1
                            winston.debug(`[Rudder] totalRequestsCompletedOnEvents :  ${totalRequestsCompleted}`)
                          }*/);
                        }
                        catch (e) {
                            errors.push(e);
                        }
                    },
                });
                yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    winston.debug("[Rudder] calling explicit flush");
                    rudderClient.flush((err) => {
                        if (err) {
                            winston.error(`[Rudder] error while flush : ${err}`);
                            reject(err);
                        }
                        else {
                            winston.debug("[Rudder] resolve while flush");
                            resolve();
                        }
                    });
                }));
                winston.debug(`[Rudder] totalrows : ${totalRows}`);
                winston.debug(`[Rudder] totalRequestsCompletedAfterRowsCompleted : ${totalRequestsCompleted}`);
            }
            catch (e) {
                winston.error(`[Rudder] error in Rudder action execution : ${e}`);
                errors.push(e);
            }
            if (errors.length > 0) {
                let msg = errors.map((e) => (e.message ? e.message : e)).join(", ");
                if (msg.length === 0) {
                    msg = "An unknown error occurred while processing the Rudder action.";
                    winston.warn(`[Rudder] Can't format Rudder errors: ${util.inspect(errors)}`);
                }
                winston.error(`[Rudder] total errors : ${msg}`);
                return new Hub.ActionResponse({ success: false, message: msg });
            }
            else {
                winston.debug("[Rudder] no errors in Rudder action execution");
                return new Hub.ActionResponse({ success: true });
            }
        });
    }
    unassignedRudderFieldsCheck(rudderFields) {
        if (!(rudderFields && rudderFields.idFieldNames.length > 0)) {
            throw new rudderstack_error_1.RudderActionError(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`);
        }
    }
    taggedFields(fields, tags) {
        return fields.filter((f) => f.tags &&
            f.tags.length > 0 &&
            f.tags.some((t) => tags.indexOf(t) !== -1));
    }
    taggedField(fields, tags) {
        return this.taggedFields(fields, tags)[0];
    }
    rudderFields(fields) {
        const idFieldNames = this.taggedFields(fields, [
            RudderTags.Email,
            RudderTags.RudderAnonymousId,
            RudderTags.UserId,
            RudderTags.RudderGroupId,
        ]).map((f) => f.name);
        return {
            idFieldNames,
            idField: this.taggedField(fields, [
                RudderTags.UserId,
                RudderTags.RudderAnonymousId,
            ]),
            userIdField: this.taggedField(fields, [RudderTags.UserId]),
            groupIdField: this.taggedField(fields, [RudderTags.RudderGroupId]),
            emailField: this.taggedField(fields, [RudderTags.Email]),
            anonymousIdField: this.taggedField(fields, [
                RudderTags.RudderAnonymousId,
            ]),
        };
    }
    // Removes JsonDetail Cell metadata and only sends relevant nested data to Rudder
    // See JsonDetail.ts to see structure of a JsonDetail Row
    filterJson(jsonRow, rudderFields, fieldName) {
        const pivotValues = {};
        pivotValues[fieldName] = [];
        const filterFunction = (currentObject, name) => {
            const returnVal = {};
            if (Object(currentObject) === currentObject) {
                for (const key in currentObject) {
                    if (currentObject.hasOwnProperty(key)) {
                        if (key === "value") {
                            returnVal[name] = currentObject[key];
                            return returnVal;
                        }
                        else if (rudderFields.idFieldNames.indexOf(key) === -1) {
                            const res = filterFunction(currentObject[key], key);
                            if (Object.keys(res).length > 0) {
                                pivotValues[fieldName].push(res);
                            }
                        }
                    }
                }
            }
            return returnVal;
        };
        filterFunction(jsonRow, fieldName);
        return pivotValues;
    }
    prepareRudderTraitsFromRow(row, fields, rudderFields, hiddenFields, trackCall) {
        const traits = {};
        for (const field of fields) {
            if (rudderFields.idFieldNames.indexOf(field.name) === -1) {
                if (hiddenFields.indexOf(field.name) === -1) {
                    let values = {};
                    if (!row.hasOwnProperty(field.name)) {
                        winston.error("[Rudder] Field name does not exist for Rudder action");
                        throw new rudderstack_error_1.RudderActionError(`Field id ${field.name} does not exist for JsonDetail.Row`);
                    }
                    if (row[field.name].value) {
                        values[field.name] = row[field.name].value;
                    }
                    else {
                        values = this.filterJson(row[field.name], rudderFields, field.name);
                    }
                    for (const key in values) {
                        if (values.hasOwnProperty(key)) {
                            traits[key] = values[key];
                        }
                    }
                }
            }
            if (rudderFields.emailField &&
                field.name === rudderFields.emailField.name) {
                traits.email = row[field.name].value;
            }
        }
        let userId = rudderFields.idField
            ? row[rudderFields.idField.name].value
            : null;
        if (rudderFields.userIdField) {
            userId = row[rudderFields.userIdField.name].value;
        }
        else {
            userId = null;
        }
        let anonymousId;
        if (rudderFields.anonymousIdField) {
            anonymousId = row[rudderFields.anonymousIdField.name].value;
        }
        else {
            anonymousId = userId ? null : this.generateAnonymousId();
        }
        const groupId = rudderFields.groupIdField
            ? row[rudderFields.groupIdField.name].value
            : null;
        const dimensionName = trackCall ? "properties" : "traits";
        const rudderRow = {
            userId,
            anonymousId,
            groupId,
        };
        rudderRow[dimensionName] = traits;
        return rudderRow;
    }
    rudderClientFromRequest(request) {
        return new rudder_sdk_node_1.default(request.params.rudder_write_key, {
            dataPlaneUrl: request.params.rudder_server_url,
        });
    }
    generateAnonymousId() {
        return uuid.v4();
    }
}
exports.RudderAction = RudderAction;
Hub.addAction(new RudderAction());
