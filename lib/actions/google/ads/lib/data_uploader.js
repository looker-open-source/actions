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
exports.GoogleAdsUserListUploader = void 0;
const crypto = require("crypto");
const lodash = require("lodash");
const oboe = require("oboe");
const BATCH_SIZE = 10 * 1000;
class GoogleAdsUserListUploader {
    constructor(adsExecutor) {
        this.adsExecutor = adsExecutor;
        this.adsRequest = this.adsExecutor.adsRequest;
        this.doHashingBool = this.adsRequest.doHashingBool;
        this.log = this.adsRequest.log;
        this.batchPromises = [];
        this.batchQueue = [];
        this.isSchemaDetermined = false;
        this.rowQueue = [];
        this.schema = {};
        /*
         * If the Looker column label matches the regex, that label will be added to the schema object
         * with its value set to the corresponding output property path given below.
         * Then when subsequent rows come through, we use the schema object keys to get the columns we care about,
         * and put those values into the corresponding output path, as given by the schema object values.
         *
         * Example 1st row: {"User Email Address": "lukeperry@example.com", "US Zipcode": "90210"}
         * Schema object: {"User Email Address": "hashed_email", "US Zipcode": "address_info.postal_code"}
         * Parsed result: [{"hashed_email": "lukeperry@example.com"}, {"address_info": {"postal_code": "90210"}}]
         *                                   ^^^^^^^ Except the email could actually be a hash
         *
         * Note: mobile device data cannot be combined with any other types of customer data,
         * therefore the regex conditions are kept separate
         */
        this.regexes = [
            ...this.adsRequest.isMobileDevice ? [
                [/idfa|identifier.for.advertising/i, "mobile_id"],
                [/aaid|advertiser.assigned.user|google.advertising/i, "third_party_user_id"],
            ] : [
                [/email/i, "hashed_email"],
                [/phone/i, "hashed_phone_number"],
                [/first/i, "address_info.hashed_first_name"],
                [/last/i, "address_info.hashed_last_name"],
                [/street|address/i, "address_info.hashed_street_address"],
                [/city/i, "address_info.city"],
                [/state/i, "address_info.state"],
                [/country/i, "address_info.country_code"],
                [/postal|zip/i, "address_info.postal_code"],
            ],
        ];
    }
    get batchIsReady() {
        return this.rowQueue.length >= BATCH_SIZE;
    }
    get numBatches() {
        return this.batchPromises.length;
    }
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // The ActionRequest.prototype.stream() method is going to await the callback we pass
                // and either resolve the result we return here, or reject with an error from anywhere
                yield this.adsRequest.streamingDownload((downloadStream) => __awaiter(this, void 0, void 0, function* () {
                    return this.startAsyncParser(downloadStream);
                }));
            }
            catch (errorReport) {
                // TODO: the oboe fail() handler sends an errorReport object, but that might not be the only thing we catch
                this.log("error", "Streaming parse failure toString:", errorReport.toString());
                this.log("error", "Streaming parse failure JSON:", JSON.stringify(errorReport));
            }
            yield Promise.all(this.batchPromises);
            this.log("info", `Streaming upload complete. Sent ${this.numBatches} batches (batch size = ${BATCH_SIZE})`);
        });
    }
    startAsyncParser(downloadStream) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                oboe(downloadStream)
                    .node("!.*", (row) => {
                    if (!this.isSchemaDetermined) {
                        this.determineSchema(row);
                    }
                    this.handleRow(row);
                    this.scheduleBatch();
                    return oboe.drop;
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
            for (const mapping of this.regexes) {
                const [regex, outputPath] = mapping;
                if (columnLabel.match(regex)) {
                    this.schema[columnLabel] = outputPath;
                }
            }
        }
        this.isSchemaDetermined = true;
    }
    handleRow(row) {
        const output = this.transformRow(row);
        this.rowQueue.push(output);
    }
    transformRow(row) {
        const schemaMapping = Object.entries(this.schema);
        const outputCells = schemaMapping.map(([columnLabel, outputPath]) => {
            let outputValue = row[columnLabel];
            if (!outputValue) {
                return null;
            }
            if (this.doHashingBool && outputPath.includes("hashed")) {
                outputValue = this.normalizeAndHash(outputValue);
            }
            return lodash.set({}, outputPath, outputValue);
        });
        return { create: { user_identifiers: outputCells.filter(Boolean) } };
    }
    // Formatting guidelines: https://support.google.com/google-ads/answer/7476159?hl=en
    normalizeAndHash(rawValue) {
        const normalized = rawValue.trim().toLowerCase();
        const hashed = crypto.createHash("sha256").update(normalized).digest("hex");
        return hashed;
    }
    scheduleBatch(force = false) {
        if (!this.batchIsReady && !force) {
            return;
        }
        const batch = this.rowQueue.splice(0, BATCH_SIZE - 1);
        this.batchQueue.push(batch);
        this.batchPromises.push(this.sendBatch());
        this.log("debug", `Sent batch number: ${this.numBatches}`);
    }
    // The Ads API seems to generate a concurrent modification exception if we have multiple
    // addDataJobOperations requests in progress at one time. So we use this funky solution
    // to run one at a time, without having to refactor the streaming parser and everything too.
    sendBatch() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.currentRequest !== undefined || this.batchQueue.length === 0) {
                return;
            }
            yield this.adsRequest.checkTokens().then(() => __awaiter(this, void 0, void 0, function* () {
                const currentBatch = this.batchQueue.shift();
                this.currentRequest = this.adsExecutor.addDataJobOperations(currentBatch);
                yield this.currentRequest;
                this.currentRequest = undefined;
                return this.sendBatch();
            }));
        });
    }
}
exports.GoogleAdsUserListUploader = GoogleAdsUserListUploader;
