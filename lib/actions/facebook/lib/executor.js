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
const Hub = require("../../../hub");
const crypto = require("crypto");
const oboe = require("oboe");
const winston = require("winston");
const api_1 = require("./api");
const api_2 = require("./api");
const util_1 = require("./util");
const BATCH_SIZE = 10000; // Maximum size allowable by Facebook endpoint
class FacebookCustomAudiencesExecutor {
    constructor(actionRequest, accessToken) {
        this.batchPromises = [];
        this.batchQueue = [];
        this.isSchemaDetermined = false;
        this.matchedHashCombinations = [];
        this.rowQueue = [];
        this.schema = {};
        this.batchIncrementer = 0;
        // form params
        this.shouldHash = true;
        this.customAudienceId = "";
        this.customAudienceName = "";
        this.customAudienceDescription = "";
        this.fieldMapping = [
            {
                lookMLTagName: "email",
                fallbackRegex: /email/i,
                userField: "email",
                normalizationFunction: this.normalize,
            },
            {
                lookMLTagName: "phone",
                fallbackRegex: /phone/i,
                userField: "phone",
                normalizationFunction: util_1.removeNonRomanAlphaNumeric,
            },
            {
                lookMLTagName: "birth_year",
                fallbackRegex: /year/i,
                userField: "birthYear",
                normalizationFunction: (value) => util_1.getYear(this.normalize(value)),
            },
            {
                lookMLTagName: "birth_month",
                fallbackRegex: /month/i,
                userField: "birthMonth",
                normalizationFunction: (value) => util_1.getMonth(this.normalize(value)),
            },
            {
                lookMLTagName: "birth_day",
                fallbackRegex: /day/i,
                userField: "birthDay",
                normalizationFunction: (value) => util_1.getDayOfMonth(this.normalize(value)),
            },
            {
                lookMLTagName: "last_name",
                fallbackRegex: /last/i,
                userField: "lastName",
                normalizationFunction: this.normalize,
            },
            {
                lookMLTagName: "first_name",
                fallbackRegex: /first/i,
                userField: "firstName",
                normalizationFunction: this.normalize,
            },
            {
                lookMLTagName: "first_initial",
                fallbackRegex: /initial/i,
                userField: "firstInitial",
                normalizationFunction: (value) => util_1.removeNonRomanAlphaNumeric(this.normalize(value)),
            },
            {
                lookMLTagName: "city",
                fallbackRegex: /city/i,
                userField: "city",
                normalizationFunction: (value) => util_1.removeNonRomanAlphaNumeric(this.normalize(value)),
            },
            {
                lookMLTagName: "state",
                fallbackRegex: /state/i,
                userField: "state",
                normalizationFunction: (value) => util_1.usStateNameTo2Code(this.normalize(value)),
            },
            {
                lookMLTagName: "zip",
                fallbackRegex: /postal|zip/i,
                userField: "zip",
                normalizationFunction: this.normalize,
            },
            {
                lookMLTagName: "country",
                fallbackRegex: /country/i,
                userField: "country",
                normalizationFunction: (value) => util_1.countryNameTo2Code(this.normalize(value)),
            },
            {
                lookMLTagName: "mad_id",
                fallbackRegex: /madid/i,
                userField: "madid",
                normalizationFunction: this.normalize,
            },
            {
                lookMLTagName: "external_id",
                fallbackRegex: /external/i,
                userField: "externalId",
                normalizationFunction: (value) => value,
            },
        ];
        this.actionRequest = actionRequest;
        this.sessionId = Date.now(); // a unique id used to associate multiple requests with one custom audience API action
        this.facebookAPI = new api_2.default(accessToken);
        this.shouldHash = actionRequest.formParams.should_hash === "do_no_hashing" ? false : true;
        const operationType = actionRequest.formParams.choose_create_update_replace;
        if (!operationType) {
            throw new Error("Cannot execute action without choosing an operation type.");
        }
        this.operationType = operationType;
        if (!actionRequest.formParams.choose_ad_account) {
            throw new Error("Cannot execute action without ad account id.");
        }
        if (!actionRequest.formParams.choose_custom_audience && (operationType === "update_audience" || operationType === "replace_audience")) {
            throw new Error("Cannot update or replace without a custom audience id.");
        }
        this.adAccountId = actionRequest.formParams.choose_ad_account;
        this.customAudienceId = actionRequest.formParams.choose_custom_audience;
        this.customAudienceName = actionRequest.formParams.create_audience_name;
        this.customAudienceDescription = actionRequest.formParams.create_audience_description;
    }
    get batchIsReady() {
        return this.rowQueue.length >= BATCH_SIZE;
    }
    get numBatches() {
        return this.batchPromises.length;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = new Hub.ActionResponse();
            if (this.operationType === "create_audience") {
                if (!this.customAudienceName || !this.customAudienceDescription) {
                    throw new Error("Cannot create an audience if name or description are missing.");
                }
                const customAudienceId = yield this.facebookAPI.createCustomAudience(this.adAccountId, this.customAudienceName, this.customAudienceDescription);
                this.customAudienceId = customAudienceId;
            }
            try {
                // The ActionRequest.prototype.stream() method is going to await the callback we pass
                // and either resolve the result we return here, or reject with an error from anywhere
                yield this.actionRequest.stream((downloadStream) => __awaiter(this, void 0, void 0, function* () {
                    return this.startAsyncParser(downloadStream);
                }));
            }
            catch (errorReport) {
                const response = new Hub.ActionResponse();
                response.success = false;
                response.message = "Streaming upload failure: " + util_1.sanitizeError(errorReport);
                // TODO: the oboe fail() handler sends an errorReport object, but that might not be the only thing we catch
                winston.error("Streaming parse failure:" + util_1.sanitizeError(errorReport + ""));
                if ((errorReport + "").indexOf("CLEANFAIL") >= 0) {
                    response.success = true;
                }
                return response;
            }
            yield Promise.all(this.batchPromises);
            const successMessage = `Streaming upload complete. Sent ${this.numBatches} batches (batch size = ${BATCH_SIZE})`;
            winston.debug("info", successMessage);
            resp.success = true;
            resp.message = successMessage;
            return resp;
        });
    }
    startAsyncParser(downloadStream) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                oboe(downloadStream)
                    .node({ "!.fields": (fieldData) => {
                        // we only pull the high level fields data once in a separate listener. purely to determine the schema
                        winston.debug("info", `Received stream data. Determining schema from LookML field tags and regex.`);
                        if (!this.isSchemaDetermined) {
                            // Field data looks like: {measures: Array(0),
                            // dimensions: Array(8), table_calculations: Array(0), pivots: Array(0)}
                            let combinedFields = [...fieldData.dimensions,
                                ...fieldData.measures,
                                ...fieldData.table_calculations];
                            // prune the object to just the subset of data we need, then combine into one object
                            combinedFields = combinedFields.reduce((aggregator, field) => {
                                aggregator[field.name] = {
                                    value: null,
                                    tags: field.tags,
                                };
                                return aggregator;
                            }, {});
                            try {
                                this.determineSchema(combinedFields);
                            }
                            catch (err) {
                                reject("CLEANFAIL " + err); // cleanly fail without crashing action hub
                            }
                        }
                        return oboe.drop;
                    }, "!.data.*": (row) => {
                        // the reduce below just strips the superfluous object and "value property from the row
                        // i.e. { users.city:{value: 'Abbeville'}, "users.zip": ... }
                        // becomes
                        // { users.city: 'Abbeville' }
                        row = Object.entries(row).reduce((accumulator, [key, val]) => {
                            accumulator[key] = val.value;
                            return accumulator;
                        }, {});
                        this.handleRow(row);
                        this.scheduleBatch();
                        return oboe.drop;
                    },
                })
                    .done(() => {
                    this.scheduleBatch(true);
                    resolve();
                })
                    .fail(reject);
            });
        });
    }
    determineSchema(row) {
        for (const columnLabel of Object.keys(row)) {
            let tagMatched = false;
            for (const mapping of this.fieldMapping) {
                const { fallbackRegex, lookMLTagName } = mapping;
                // attempt to match fields by lookml tags first
                if (row[columnLabel].tags && row[columnLabel].tags.length > 0) {
                    if (row[columnLabel].tags.some((tag) => tag.toLowerCase() === lookMLTagName.toLowerCase())) {
                        tagMatched = true;
                        this.schema[columnLabel] = mapping;
                        winston.debug("info", `Matched ${columnLabel} by LookML field tag.`);
                        break;
                    }
                }
                if (columnLabel.match(fallbackRegex)) {
                    tagMatched = true;
                    this.schema[columnLabel] = mapping;
                    winston.debug("info", `Matched ${columnLabel} by regex.`);
                    break;
                }
            }
            if (!tagMatched) {
                winston.debug("info", `Could not match field ${columnLabel} by tags or regex. Dropping it from upload.`);
            }
        }
        const formattedRow = this.getFormattedRow(row, this.schema);
        this.matchedHashCombinations = this.getMatchingHashCombinations(formattedRow, api_1.validFacebookHashCombinations);
        if (this.matchedHashCombinations.length <= 0) {
            throw new Error("Could not match your data to any valid Facebook data combinations." +
                "See documentation for details. No data has been sent to Facebook. CLEANFAIL");
        }
        this.isSchemaDetermined = true;
    }
    /*
  IN
      {
        "Users First Name": "Timmy",
        "Users Email": "tt@coolguy.net",
        ...
      },
      {
        "Users First Name": {..., userField: "firstName"},
        ...
      }
  
  OUT
      {
        email: "tt@coolguy.net",
        phone: null,
        birthYear: null,
        birthMonth: null,
        birthDay: null,
        lastName: null,
        firstName: "Timmy",
        firstInitial: null,
        city: null,
        state: null,
        zip: null,
        country: null,
        madid: null,
        externalId: null,
      }
  */
    // Get a uniform object that's easy to feed to transform functions
    getFormattedRow(row, schema) {
        const formattedRow = this.getEmptyFormattedRow();
        Object.entries(schema).forEach(([columnLabel, mapping]) => {
            formattedRow[mapping.userField] = row[columnLabel];
        });
        return formattedRow;
    }
    getEmptyFormattedRow(initialValue = null) {
        return {
            email: initialValue,
            phone: initialValue,
            birthYear: initialValue,
            birthMonth: initialValue,
            birthDay: initialValue,
            lastName: initialValue,
            firstName: initialValue,
            firstInitial: initialValue,
            city: initialValue,
            state: initialValue,
            zip: initialValue,
            country: initialValue,
            madid: initialValue,
            externalId: initialValue,
        };
    }
    // Pass in the ones you have and this will
    // return only the hash combinations you have enough data for
    getMatchingHashCombinations(fieldsWithData, hashCombinations) {
        const dummyFormattedRow = this.getEmptyFormattedRow("EMPTY");
        Object.entries(fieldsWithData).forEach(([field, data]) => {
            if (data !== null) {
                dummyFormattedRow[field] = "FILLED";
            }
        });
        // this was a very fancy way of creating a complete formatted row with
        // only the fields you have using non-null values
        // just return the ones that didn't have the EMPTY string in them
        return hashCombinations.filter((hc) => {
            const transformFunction = hc[0];
            const returnedString = transformFunction(dummyFormattedRow);
            return returnedString.indexOf("EMPTY") < 0;
        });
    }
    handleRow(row) {
        const output = this.transformRow(row);
        this.rowQueue.push(output);
    }
    /*
      Transforms a row of Looker data into a row of data formatted for the Facebook marketing API.
      Missing data is filled in with empty strings.
    */
    transformRow(row) {
        row = this.normalizeRow(row);
        const formattedRow = this.getFormattedRow(row, this.schema); // get a uniform object
        // turn our uniform object into X strings like doe_john_30008_1974. One per transform we have enough data for
        const transformedRow = this.matchedHashCombinations.map(([transformFunction, _facebookAPIFieldName]) => {
            if (this.shouldHash) {
                return this.hash(transformFunction(formattedRow));
            }
            return transformFunction(formattedRow);
        });
        // return array for each row
        return transformedRow;
    }
    normalizeRow(row) {
        const normalizedRow = Object.assign({}, row);
        Object.entries(this.schema).forEach(([columnLabel, mapping]) => {
            const rowValue = row[columnLabel] + ""; // coercec things like phone numbers to string
            normalizedRow[columnLabel] = mapping.normalizationFunction(rowValue);
        });
        return normalizedRow;
    }
    createUploadSessionObject(batchSequence, finalBatch) {
        const sessionObject = {
            session_id: this.sessionId,
            batch_seq: batchSequence,
            last_batch_flag: finalBatch,
        };
        return sessionObject;
    }
    hash(rawValue) {
        return crypto.createHash("sha256").update(rawValue).digest("hex");
    }
    normalize(rawValue) {
        return rawValue.trim().toLowerCase();
    }
    scheduleBatch(finalBatch = false) {
        if (!this.batchIsReady && !finalBatch) {
            return;
        }
        this.batchIncrementer += 1;
        const batch = {
            data: this.rowQueue.splice(0, BATCH_SIZE - 1),
            batchSequence: this.batchIncrementer,
            finalBatch,
        };
        this.batchQueue.push(batch);
        this.batchPromises.push(this.sendBatch());
    }
    sendBatch() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentRequest !== undefined || this.batchQueue.length === 0) {
                return;
            }
            const { batchSequence, data: currentBatch, finalBatch } = this.batchQueue.shift();
            const sessionParameter = this.createUploadSessionObject(batchSequence, finalBatch);
            const payloadParameter = {
                schema: this.matchedHashCombinations.map(([_transformFunction, facebookAPIFieldName]) => facebookAPIFieldName),
                data: currentBatch,
            };
            let apiMethodToCall = this.facebookAPI.appendUsersToCustomAudience.bind(this.facebookAPI);
            if (this.operationType === "replace_audience") {
                apiMethodToCall = this.facebookAPI.replaceUsersInCustomAudience.bind(this.facebookAPI);
            }
            if (!this.customAudienceId) {
                throw new Error("Could not upload users because customAudienceId was missing.");
            }
            this.currentRequest = apiMethodToCall(this.customAudienceId, sessionParameter, payloadParameter);
            yield this.currentRequest;
            this.currentRequest = undefined;
            return this.sendBatch();
        });
    }
}
exports.default = FacebookCustomAudiencesExecutor;
