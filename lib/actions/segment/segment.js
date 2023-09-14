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
exports.SegmentAction = exports.SegmentCalls = exports.SegmentTags = void 0;
const util = require("util");
const uuid = require("uuid");
const winston = require("winston");
const semver = require("semver");
const Hub = require("../../hub");
const segment_error_1 = require("./segment_error");
const segment = require("analytics-node");
var SegmentTags;
(function (SegmentTags) {
    SegmentTags["UserId"] = "user_id";
    SegmentTags["SegmentAnonymousId"] = "segment_anonymous_id";
    SegmentTags["Email"] = "email";
    SegmentTags["SegmentGroupId"] = "segment_group_id";
})(SegmentTags = exports.SegmentTags || (exports.SegmentTags = {}));
var SegmentCalls;
(function (SegmentCalls) {
    SegmentCalls["Identify"] = "identify";
    SegmentCalls["Track"] = "track";
    SegmentCalls["Group"] = "group";
})(SegmentCalls = exports.SegmentCalls || (exports.SegmentCalls = {}));
class SegmentAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.allowedTags = [SegmentTags.Email, SegmentTags.UserId, SegmentTags.SegmentAnonymousId];
        this.name = "segment_event";
        this.label = "Segment Identify";
        this.iconName = "segment/segment.png";
        this.description = "Add traits via identify to your Segment users.";
        this.params = [
            {
                description: "A write key for Segment.",
                label: "Segment Write Key",
                name: "segment_write_key",
                required: true,
                sensitive: true,
            },
        ];
        this.minimumSupportedLookerVersion = "4.20.0";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.usesStreaming = true;
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
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
            return this.executeSegment(request, SegmentCalls.Identify);
        });
    }
    executeSegment(request, segmentCall) {
        return __awaiter(this, void 0, void 0, function* () {
            const segmentClient = this.segmentClientFromRequest(request);
            let hiddenFields = [];
            if (request.scheduledPlan &&
                request.scheduledPlan.query &&
                request.scheduledPlan.query.vis_config &&
                request.scheduledPlan.query.vis_config.hidden_fields) {
                hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields;
            }
            let segmentFields;
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
                yield request.streamJsonDetail({
                    onFields: (fields) => {
                        fieldset = Hub.allFields(fields);
                        segmentFields = this.segmentFields(fieldset);
                        this.unassignedSegmentFieldsCheck(segmentFields);
                    },
                    onRanAt: (iso8601string) => {
                        if (iso8601string) {
                            timestamp = new Date(iso8601string);
                        }
                    },
                    onRow: (row) => {
                        this.unassignedSegmentFieldsCheck(segmentFields);
                        const payload = Object.assign(Object.assign({}, this.prepareSegmentTraitsFromRow(row, fieldset, segmentFields, hiddenFields, segmentCall === SegmentCalls.Track, segmentCall === SegmentCalls.Group)), { event, context, timestamp });
                        if (payload.groupId === null) {
                            delete payload.groupId;
                        }
                        if (!payload.event) {
                            delete payload.event;
                        }
                        try {
                            segmentClient[segmentCall](payload);
                        }
                        catch (e) {
                            errors.push(e);
                        }
                    },
                });
                yield new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    segmentClient.flush((err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
                            resolve();
                        }
                    });
                }));
            }
            catch (e) {
                errors.push(e);
            }
            if (errors.length > 0) {
                let msg = errors.map((e) => e.message ? e.message : e).join(", ");
                if (msg.length === 0) {
                    msg = "An unknown error occurred while processing the Segment action.";
                    winston.warn(`Can't format Segment errors: ${util.inspect(errors)}`);
                }
                return new Hub.ActionResponse({ success: false, message: msg });
            }
            else {
                return new Hub.ActionResponse({ success: true });
            }
        });
    }
    unassignedSegmentFieldsCheck(segmentFields) {
        if (!(segmentFields && segmentFields.idFieldNames.length > 0)) {
            throw new segment_error_1.SegmentActionError(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`);
        }
    }
    taggedFields(fields, tags) {
        return fields.filter((f) => f.tags && f.tags.length > 0 && f.tags.some((t) => tags.indexOf(t) !== -1));
    }
    taggedField(fields, tags) {
        return this.taggedFields(fields, tags)[0];
    }
    segmentFields(fields) {
        const idFieldNames = this.taggedFields(fields, [
            SegmentTags.Email,
            SegmentTags.SegmentAnonymousId,
            SegmentTags.UserId,
            SegmentTags.SegmentGroupId,
        ]).map((f) => (f.name));
        return {
            idFieldNames,
            idField: this.taggedField(fields, [SegmentTags.UserId, SegmentTags.SegmentAnonymousId]),
            userIdField: this.taggedField(fields, [SegmentTags.UserId]),
            groupIdField: this.taggedField(fields, [SegmentTags.SegmentGroupId]),
            emailField: this.taggedField(fields, [SegmentTags.Email]),
            anonymousIdField: this.taggedField(fields, [SegmentTags.SegmentAnonymousId]),
        };
    }
    // Removes JsonDetail Cell metadata and only sends relevant nested data to Segment
    // See JsonDetail.ts to see structure of a JsonDetail Row
    filterJson(jsonRow, segmentFields, fieldName) {
        const pivotValues = {};
        pivotValues[fieldName] = [];
        const filterFunction = (currentObject, name) => {
            const returnVal = {};
            if (Object(currentObject) === currentObject) {
                for (const key in currentObject) {
                    if (currentObject.hasOwnProperty(key)) {
                        if (key === "value") {
                            returnVal[name] = currentObject[key];
                            // Segment Identify Nulls #186583506
                            if (currentObject[key] === null) {
                                pivotValues[fieldName] = null;
                            }
                            return returnVal;
                        }
                        else if (segmentFields.idFieldNames.indexOf(key) === -1) {
                            const res = filterFunction(currentObject[key], key);
                            if (JSON.stringify(res) !== JSON.stringify({})) {
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
    prepareSegmentTraitsFromRow(row, fields, segmentFields, hiddenFields, trackCall, groupCall) {
        const traits = {};
        for (const field of fields) {
            if (segmentFields.idFieldNames.indexOf(field.name) === -1) {
                if (hiddenFields.indexOf(field.name) === -1) {
                    let values = {};
                    if (!row.hasOwnProperty(field.name)) {
                        winston.error("Field name does not exist for Segment action");
                        throw new segment_error_1.SegmentActionError(`Field id ${field.name} does not exist for JsonDetail.Row`);
                    }
                    if (row[field.name].value || row[field.name].value === 0) {
                        values[field.name] = row[field.name].value;
                    }
                    else {
                        values = this.filterJson(row[field.name], segmentFields, field.name);
                    }
                    for (const key in values) {
                        if (values.hasOwnProperty(key)) {
                            traits[key] = values[key];
                        }
                    }
                }
            }
            if (segmentFields.emailField && field.name === segmentFields.emailField.name) {
                traits.email = row[field.name].value;
            }
        }
        const userId = segmentFields.idField ? row[segmentFields.idField.name].value : null;
        let anonymousId;
        if (segmentFields.anonymousIdField) {
            anonymousId = row[segmentFields.anonymousIdField.name].value;
        }
        else if (groupCall) {
            // If this is a Segment Group Call, do not send an anonymous ID to preserve
            // Segment API quotas
            anonymousId = null;
        }
        else {
            anonymousId = userId ? null : this.generateAnonymousId();
        }
        const groupId = segmentFields.groupIdField ? row[segmentFields.groupIdField.name].value : null;
        const dimensionName = trackCall ? "properties" : "traits";
        const segmentRow = {
            userId,
            anonymousId,
            groupId,
        };
        segmentRow[dimensionName] = traits;
        return segmentRow;
    }
    segmentClientFromRequest(request) {
        return new segment(request.params.segment_write_key);
    }
    generateAnonymousId() {
        return uuid.v4();
    }
}
exports.SegmentAction = SegmentAction;
Hub.addAction(new SegmentAction());
