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
exports.MparticleTransaction = void 0;
const Hub = require("../../hub");
const httpRequest = require("request-promise-native");
const mparticle_constants_1 = require("./mparticle_constants");
const mparticle_enums_1 = require("./mparticle_enums");
const mparticle_error_codes_1 = require("./mparticle_error_codes");
class MparticleTransaction {
    constructor() {
        this.eventType = "";
        this.environment = "";
        this.errors = [];
        // The mapping for user-related data
        this.userIdentities = {
            [mparticle_enums_1.MparticleUserTags.MpCustomerId]: mparticle_enums_1.MparticleUserMaps.Customerid,
            [mparticle_enums_1.MparticleUserTags.MpEmail]: mparticle_enums_1.MparticleUserMaps.Email,
            [mparticle_enums_1.MparticleUserTags.MpFacebook]: mparticle_enums_1.MparticleUserMaps.Facebook,
            [mparticle_enums_1.MparticleUserTags.MpGoogle]: mparticle_enums_1.MparticleUserMaps.Google,
            [mparticle_enums_1.MparticleUserTags.MpMicrosoft]: mparticle_enums_1.MparticleUserMaps.Microsoft,
            [mparticle_enums_1.MparticleUserTags.MpTwitter]: mparticle_enums_1.MparticleUserMaps.Twitter,
            [mparticle_enums_1.MparticleUserTags.MpYahoo]: mparticle_enums_1.MparticleUserMaps.Yahoo,
            [mparticle_enums_1.MparticleUserTags.MpOther]: mparticle_enums_1.MparticleUserMaps.Other,
            [mparticle_enums_1.MparticleUserTags.MpOther2]: mparticle_enums_1.MparticleUserMaps.Other2,
            [mparticle_enums_1.MparticleUserTags.MpOther3]: mparticle_enums_1.MparticleUserMaps.Other3,
            [mparticle_enums_1.MparticleUserTags.MpOther4]: mparticle_enums_1.MparticleUserMaps.Other4,
        };
        // The mapping for event-related data, specific to API request's data section.
        this.dataEventAttributes = {
            [mparticle_enums_1.MparticleEventTags.MpCustomEventType]: mparticle_enums_1.MparticleEventMaps.CustomEventType,
            [mparticle_enums_1.MparticleEventTags.MpEventId]: mparticle_enums_1.MparticleEventMaps.EventId,
            [mparticle_enums_1.MparticleEventTags.MpTimestampUnixtimeMs]: mparticle_enums_1.MparticleEventMaps.TimestampUnixtimeMs,
            [mparticle_enums_1.MparticleEventTags.MpSessionId]: mparticle_enums_1.MparticleEventMaps.SessionId,
            [mparticle_enums_1.MparticleEventTags.MpSessionUuid]: mparticle_enums_1.MparticleEventMaps.SessionUuid,
        };
    }
    handleRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            let rows = [];
            let mapping = {};
            this.eventType = this.setEventType(request.formParams.data_type);
            this.environment = this.setEnvironment(request.formParams.environment);
            const { apiKey, apiSecret } = request.params;
            this.apiKey = apiKey;
            this.apiSecret = apiSecret;
            try {
                yield request.streamJsonDetail({
                    onFields: (fields) => {
                        mapping = this.createMappingFromFields(fields);
                    },
                    onRow: (row) => {
                        rows.push(row);
                        if (rows.length === mparticle_constants_1.MAX_EVENTS_PER_BATCH) {
                            this.sendChunk(rows, mapping).catch((e) => {
                                throw e;
                            });
                            rows = [];
                        }
                    },
                });
            }
            catch (e) {
                if (e === "Each row must specify at least 1 identity tag.") {
                    throw e;
                }
                this.errors.push(e);
            }
            try {
                // if any rows are left, send one more chunk
                if (rows.length > 0) {
                    yield this.sendChunk(rows, mapping);
                }
                if (this.errors.length === 0) {
                    return new Hub.ActionResponse({ success: true });
                }
                else {
                    return new Hub.ActionResponse({ success: false, message: this.errors[0] });
                }
            }
            catch (e) {
                return new Hub.ActionResponse({ success: false, message: e.message });
            }
        });
    }
    sendChunk(rows, mapping) {
        return __awaiter(this, void 0, void 0, function* () {
            const chunk = rows.slice(0);
            const body = [];
            chunk.forEach((row) => {
                const eventEntry = this.createEvent(row, mapping);
                body.push(eventEntry);
            });
            const options = this.postOptions(body);
            yield httpRequest.post(options).promise().catch((e) => {
                this.errors.push(`${e.statusCode} - ${mparticle_error_codes_1.mparticleErrorCodes[e.statusCode]}`);
            });
        });
    }
    createEvent(row, mapping) {
        const eventUserIdentities = {};
        const eventUserAttributes = {};
        const data = {};
        const deviceInfo = {};
        Object.keys(mapping.userIdentities).forEach((attr) => {
            const key = mapping.userIdentities[attr];
            const val = row[attr].value;
            eventUserIdentities[key] = val;
        });
        Object.keys(mapping.userAttributes).forEach((attr) => {
            const key = mapping.userAttributes[attr];
            const val = row[attr].value;
            eventUserAttributes[key] = val;
        });
        if (this.eventType === mparticle_constants_1.EVENT) {
            data.custom_attributes = {};
            if (Object.keys(mapping.eventName).length !== 0) {
                Object.keys(mapping.eventName).forEach((attr) => {
                    const val = row[attr].value;
                    data.event_name = val;
                });
            }
            else {
                data.event_name = mparticle_constants_1.DEFAULT_EVENT_NAME;
            }
            if (mapping.deviceInfo) {
                Object.keys(mapping.deviceInfo).forEach((attr) => {
                    const key = mapping.deviceInfo[attr];
                    const val = row[attr].value;
                    deviceInfo[key] = val;
                });
            }
            if (mapping.dataEventAttributes) {
                Object.keys(mapping.dataEventAttributes).forEach((attr) => {
                    const key = mapping.dataEventAttributes[attr];
                    const val = row[attr].value;
                    data[key] = val;
                });
            }
            if (mapping.customAttributes) {
                Object.keys(mapping.customAttributes).forEach((attr) => {
                    const key = mapping.customAttributes[attr];
                    const val = row[attr].value;
                    data.custom_attributes[key] = val;
                });
            }
            if (!data.hasOwnProperty(mparticle_enums_1.MparticleEventMaps.CustomEventType)) {
                data[mparticle_enums_1.MparticleEventMaps.CustomEventType] = mparticle_constants_1.DEFAULT_CUSTOM_EVENT_TYPE;
            }
        }
        const events = this.eventType === mparticle_constants_1.EVENT ? [{ data, event_type: mparticle_constants_1.EVENT_TYPE }] : [];
        return {
            events,
            user_attributes: eventUserAttributes,
            user_identities: eventUserIdentities,
            device_info: deviceInfo,
            schema_version: 2,
            environment: this.environment,
        };
    }
    containsUserIdentity(userIdentities) {
        return (Object.getOwnPropertyNames(userIdentities).length > 0);
    }
    setEventType(dataType) {
        if (dataType === mparticle_constants_1.USER) {
            return mparticle_constants_1.USER;
        }
        else if (dataType === mparticle_constants_1.EVENT) {
            return mparticle_constants_1.EVENT;
        }
        throw "Missing data type (user|event).";
    }
    setEnvironment(env) {
        if (env === mparticle_constants_1.PROD_ENVIRONMENT) {
            return mparticle_constants_1.PROD_ENVIRONMENT;
        }
        return mparticle_constants_1.DEV_ENVIRONMENT;
    }
    // Sets up the map object and loops over all fields.
    createMappingFromFields(fields) {
        let mapping;
        if (this.eventType === mparticle_constants_1.USER) {
            mapping = {
                userIdentities: {},
                userAttributes: {},
                eventName: {},
            };
        }
        else {
            mapping = {
                userIdentities: {},
                userAttributes: {},
                eventName: {},
                deviceInfo: {},
                dataEventAttributes: {},
                customAttributes: {},
            };
        }
        fields.measures.forEach((field) => {
            this.mapObject(mapping, field);
        });
        fields.dimensions.forEach((field) => {
            this.mapObject(mapping, field);
        });
        fields.table_calculations.forEach((field) => {
            this.mapObject(mapping, field);
        });
        if (!this.containsUserIdentity(mapping.userIdentities)) {
            const err = "Each row must specify at least 1 identity tag.";
            this.errors.push(err);
            throw err;
        }
        return mapping;
    }
    getTag(field) {
        // tslint:disable-next-line
        if (!field.tags || !field.tags[0]) {
            return "";
        }
        // tslint:disable-next-line
        return field.tags.find((t) => t.startsWith("mp_")) || "";
    }
    mapObject(mapping, field) {
        const tag = this.getTag(field);
        if (this.eventType === mparticle_constants_1.USER) {
            if (Object.keys(this.userIdentities).indexOf(tag) !== -1) {
                mapping.userIdentities[field.name] = this.userIdentities[tag];
            }
            else if (tag === mparticle_enums_1.MparticleEventTags.MpEventName) {
                mapping.eventName[field.name] = mparticle_enums_1.MparticleEventMaps.EventName;
            }
            else {
                mapping.userAttributes[field.name] = `looker_${field.name}`;
            }
        }
        else {
            if (Object.keys(this.userIdentities).indexOf(tag) !== -1) {
                mapping.userIdentities[field.name] = this.userIdentities[tag];
                // TODO: Move into enum
            }
            else if (tag === "mp_user_attribute") {
                mapping.userAttributes[field.name] = `looker_${field.name}`;
            }
            else if (tag === mparticle_enums_1.MparticleEventTags.MpEventName) {
                mapping.eventName[field.name] = mparticle_enums_1.MparticleEventMaps.EventName;
            }
            else if (tag === mparticle_enums_1.MparticleEventTags.MpDeviceInfo) {
                const { name } = field;
                const dimensionName = name.substring(name.indexOf(".") + 1, name.length);
                if (mparticle_constants_1.VALID_DEVICE_INFO_FIELDS.includes(dimensionName)) {
                    mapping.deviceInfo[name] = dimensionName;
                }
            }
            else if (Object.keys(this.dataEventAttributes).indexOf(tag) !== -1) {
                mapping.dataEventAttributes[field.name] = this.dataEventAttributes[tag];
            }
            else if (tag === mparticle_enums_1.MparticleEventTags.MpCustomAttribute) {
                mapping.customAttributes[field.name] = `looker_${field.name}`;
            }
        }
    }
    postOptions(body) {
        const auth = Buffer
            .from(`${this.apiKey}:${this.apiSecret}`)
            .toString("base64");
        return {
            url: mparticle_constants_1.MP_API_URL,
            headers: {
                Authorization: `Basic ${auth}`,
            },
            body,
            json: true,
            resolveWithFullResponse: true,
        };
    }
}
exports.MparticleTransaction = MparticleTransaction;
