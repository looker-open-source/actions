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
exports.MarketoTransaction = void 0;
const winston = require("winston");
const Hub = require("../../hub");
const queue_1 = require("./queue");
const MARKETO = require("node-marketo-rest");
const numLeadsAllowedPerCall = 100;
class MarketoTransaction {
    constructor() {
        this.campaignIds = [];
        this.addListIds = [];
        this.removeListIds = [];
    }
    handleRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            this.campaignIds = [];
            this.addListIds = [];
            this.removeListIds = [];
            const subactionIds = (request.formParams.campaignId === undefined ? "" : request.formParams.campaignId)
                .split(/\s*,\s*/)
                .filter(Boolean);
            switch (request.formParams.subaction) {
                case undefined:
                    // The older version of the action assumed an "addToCampaign" subaction
                    this.campaignIds = subactionIds;
                    break;
                case "none":
                    if (subactionIds.length > 0) {
                        throw "Additional action of 'none' was selected, but additional action ID was provided";
                    }
                    break;
                case "addCampaign":
                    if (subactionIds.length === 0) {
                        throw "'Add to campaign' was selected, but additional action ID was not provided";
                    }
                    this.campaignIds = subactionIds;
                    break;
                case "addList":
                    if (subactionIds.length === 0) {
                        throw "'Add to list' was selected, but additional action ID was not provided";
                    }
                    this.addListIds = subactionIds;
                    break;
                case "removeList":
                    if (subactionIds.length === 0) {
                        throw "'Remove from list' was selected, but additional action ID was not provided";
                    }
                    this.removeListIds = subactionIds;
                    break;
                default:
                    throw "Unrecognized additional action type";
                    break;
            }
            this.lookupField = request.formParams.lookupField;
            if (!this.lookupField) {
                throw "Missing Lookup Field.";
            }
            this.marketo = this.marketoClientFromRequest(request);
            const queue = new queue_1.Queue();
            let rows = [];
            const sendChunk = () => {
                const chunk = rows.slice(0);
                const task = () => __awaiter(this, void 0, void 0, function* () { return this.processChunk(chunk); });
                rows = [];
                queue.addTask(task);
            };
            yield request.streamJsonDetail({
                onFields: (fields) => {
                    this.fieldMap = this.getFieldMap(Hub.allFields(fields));
                    // determine if lookupField is present in fields
                    if (!Object.keys(this.fieldMap).find((name) => this.fieldMap[name].indexOf(this.lookupField) !== -1)) {
                        throw "Marketo Lookup Field for lead not present in query.";
                    }
                },
                onRow: (row) => {
                    // add the row to our row queue
                    rows.push(row);
                    if (rows.length === numLeadsAllowedPerCall) {
                        sendChunk();
                    }
                },
            });
            // we awaited streamJsonDetail, so we've got all our rows now
            // if any rows are left, send one more chunk
            if (rows.length > 0) {
                sendChunk();
            }
            // tell the queue we're finished adding rows and await the results
            const completed = yield queue.finish();
            // filter all the successful results
            const results = (completed
                .filter((task) => task.result)
                .map((task) => task.result));
            // filter all the request errors
            const errors = (completed
                .filter((task) => task.error)
                .map((task) => task.error));
            // concatenate results and errors into a single result
            const result = {
                leads: results.reduce((memo, r) => memo.concat(r.leads), []),
                skipped: results.reduce((memo, r) => memo.concat(r.skipped), []),
                leadErrors: results.reduce((memo, r) => memo.concat(r.leadErrors), []),
                membershipErrors: results.reduce((memo, r) => memo.concat(r.membershipErrors), []),
                requestErrors: errors,
            };
            winston.debug(JSON.stringify(result, null, 2));
            if (this.hasErrors(result)) {
                const message = this.getErrorMessage(result);
                return new Hub.ActionResponse({
                    success: false,
                    message,
                });
            }
            return new Hub.ActionResponse({ success: true });
        });
    }
    processChunk(chunk) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = {
                leads: this.getLeadList(chunk),
                skipped: [],
                leadErrors: [],
                membershipErrors: [],
            };
            const leadResponse = yield this.marketo.lead.createOrUpdate(result.leads, { lookupField: this.lookupField });
            if (Array.isArray(leadResponse.errors) && leadResponse.errors.length) {
                result.leadErrors = leadResponse.errors;
            }
            const ids = [];
            leadResponse.result.forEach((lead, i) => {
                if (lead.id) {
                    ids.push({ id: lead.id });
                }
                else {
                    result.leads[i].result = lead;
                    result.skipped.push(result.leads[i]);
                }
            });
            for (const campaignId of this.campaignIds) {
                const response = yield this.marketo.campaign.request(campaignId, ids);
                result.membershipErrors =
                    result.membershipErrors.concat(response.errors !== undefined ? response.errors : []);
            }
            for (const listId of this.addListIds) {
                const response = yield this.marketo.list.addLeadsToList(listId, ids);
                result.membershipErrors =
                    result.membershipErrors.concat(response.errors !== undefined ? response.errors : []);
            }
            for (const listId of this.removeListIds) {
                const leadIds = ids.map((obj) => obj.id);
                // ^ Unlike the other two methods, removeLeadsFromList does not automatically pick the ID from an object
                // https://github.com/MadKudu/node-marketo/blob/master/lib/api/list.js#L38
                const response = yield this.marketo.list.removeLeadsFromList(listId, leadIds);
                result.membershipErrors =
                    result.membershipErrors.concat(response.errors !== undefined ? response.errors : []);
            }
            return result;
        });
    }
    marketoClientFromRequest(request) {
        return new MARKETO({
            endpoint: `${request.params.url}/rest`,
            identity: `${request.params.url}/identity`,
            clientId: request.params.clientID,
            clientSecret: request.params.clientSecret,
        });
    }
    getFieldMap(fields) {
        // Map the looker columns to the Marketo columns using tags
        const fieldMap = {};
        let hasTagMap = [];
        for (const field of fields) {
            if (field.tags && field.tags.find((tag) => tag.startsWith("marketo:"))) {
                hasTagMap = field.tags.filter((tag) => tag.startsWith("marketo:"))
                    .map((tag) => tag.split("marketo:")[1]);
                fieldMap[field.name] = hasTagMap;
            }
        }
        return fieldMap;
    }
    getLeadList(rows) {
        // Create the list of leads to be sent
        const leadList = [];
        for (const leadRow of rows) {
            const singleLead = {};
            for (const field of Object.keys(this.fieldMap)) {
                for (const tag of this.fieldMap[field]) {
                    singleLead[tag] = leadRow[field].value;
                }
            }
            leadList.push(singleLead);
        }
        return leadList;
    }
    hasErrors(result) {
        return (result.skipped.length
            || result.leadErrors.length
            || result.membershipErrors.length
            || result.requestErrors.length);
    }
    getErrorMessage(result) {
        const condensed = {};
        if (result.skipped.length) {
            condensed.skipped = this.getSkippedReasons(result.skipped);
        }
        if (result.leadErrors.length) {
            condensed.leadErrors = result.leadErrors;
        }
        if (result.membershipErrors.length) {
            condensed.membershipErrors = result.membershipErrors;
        }
        if (result.requestErrors.length) {
            condensed.requestErrors = result.requestErrors;
        }
        return JSON.stringify(condensed);
    }
    getSkippedReasons(skipped) {
        const reasons = {};
        skipped.forEach((item) => {
            // get the reason item was skipped
            const reason = item.result.reasons[0].message;
            // create the list of reasons if this is the first one
            if (!reasons[reason]) {
                reasons[reason] = [];
            }
            // add the email to the list
            reasons[reason].push(item.email);
        });
        return reasons;
    }
}
exports.MarketoTransaction = MarketoTransaction;
