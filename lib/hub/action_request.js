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
exports.ActionRequest = exports.ActionDownloadSettings = exports.ActionVisualizationFormatting = exports.ActionFormatting = exports.ActionFormat = exports.ActionType = void 0;
const oboe = require("oboe");
const httpRequest = require("request");
const semver = require("semver");
const stream_1 = require("stream");
const winston = require("winston");
const utils_1 = require("./utils");
const sanitizeFilename = require("sanitize-filename");
const data_webhook_payload_1 = require("../api_types/data_webhook_payload");
Object.defineProperty(exports, "ActionType", { enumerable: true, get: function () { return data_webhook_payload_1.DataWebhookPayloadType; } });
const integration_1 = require("../api_types/integration");
Object.defineProperty(exports, "ActionDownloadSettings", { enumerable: true, get: function () { return integration_1.IntegrationSupportedDownloadSettings; } });
Object.defineProperty(exports, "ActionFormat", { enumerable: true, get: function () { return integration_1.IntegrationSupportedFormats; } });
Object.defineProperty(exports, "ActionFormatting", { enumerable: true, get: function () { return integration_1.IntegrationSupportedFormattings; } });
Object.defineProperty(exports, "ActionVisualizationFormatting", { enumerable: true, get: function () { return integration_1.IntegrationSupportedVisualizationFormattings; } });
class ActionRequest {
    constructor() {
        this.formParams = {};
        this.params = {};
        this.lookerVersion = null;
    }
    static fromRequest(request) {
        const actionRequest = this.fromJSON(request.body);
        actionRequest.instanceId = request.header("x-looker-instance");
        actionRequest.webhookId = request.header("x-looker-webhook-id");
        const userAgent = request.header("user-agent");
        if (userAgent) {
            const version = userAgent.split("LookerOutgoingWebhook/")[1];
            actionRequest.lookerVersion = semver.valid(version, true);
        }
        return actionRequest;
    }
    // Used to turn json back into an actionRequest
    static fromIPC(json) {
        const actionRequest = new ActionRequest();
        Object.assign(actionRequest, json);
        if (actionRequest.attachment && actionRequest.attachment.dataBuffer) {
            actionRequest.attachment.dataBuffer = Buffer.from(json.attachment.dataBuffer);
        }
        return actionRequest;
    }
    static fromJSON(json) {
        if (!json) {
            throw "Request body must be valid JSON.";
        }
        const request = new ActionRequest();
        if (json.type === null) {
            throw `Action did not specify a "type".`;
        }
        else {
            request.type = json.type;
        }
        if (json.attachment) {
            request.attachment = {};
            request.attachment.mime = json.attachment.mimetype;
            request.attachment.fileExtension = json.attachment.extension;
            if (request.attachment.mime && json.attachment.data) {
                if (json.attachment.data) {
                    request.attachment.encoding = request.attachment.mime.endsWith(";base64") ? "base64" : "utf8";
                    request.attachment.dataBuffer = Buffer.from(json.attachment.data, request.attachment.encoding);
                    if (request.attachment.mime === "application/json") {
                        request.attachment.dataJSON = JSON.parse(json.attachment.data);
                    }
                }
            }
        }
        if (json.scheduled_plan) {
            request.scheduledPlan = {
                filtersDifferFromLook: json.scheduled_plan.filters_differ_from_look,
                queryId: json.scheduled_plan.query_id,
                query: json.scheduled_plan.query,
                scheduledPlanId: json.scheduled_plan.scheduled_plan_id,
                title: json.scheduled_plan.title,
                type: json.scheduled_plan.type,
                url: json.scheduled_plan.url,
                downloadUrl: json.scheduled_plan.download_url,
            };
        }
        if (json.data) {
            request.params = json.data;
        }
        if (json.form_params) {
            request.formParams = json.form_params;
        }
        return request;
    }
    empty() {
        const url = !this.scheduledPlan || !this.scheduledPlan.downloadUrl;
        const buffer = !this.attachment || !this.attachment.dataBuffer;
        return url && buffer;
    }
    /** `stream` creates and manages a stream of the request data
     *
     * ```ts
     * let prom = await request.stream(async (readable) => {
     *    return myService.uploadStreaming(readable).promise()
     * })
     * ```
     *
     * Streaming generally occurs only if Looker sends the data in a streaming fashion via a push url,
     * however it will also wrap non-streaming attachment data so that actions only need a single implementation.
     *
     * @returns A promise returning the same value as the callback's return value.
     * This promise will resolve after the stream has completed and the callback's promise
     * has also resolved.
     * @param callback A function will be caled with a Node.js `Readable` object.
     * The readable object represents the streaming data.
     */
    stream(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = new stream_1.PassThrough();
            const returnPromise = callback(stream);
            const timeout = process.env.ACTION_HUB_STREAM_REQUEST_TIMEOUT ?
                parseInt(process.env.ACTION_HUB_STREAM_REQUEST_TIMEOUT, 10)
                :
                    13 * 60 * 1000;
            const url = this.scheduledPlan && this.scheduledPlan.downloadUrl;
            const streamPromise = new Promise((resolve, reject) => {
                if (url) {
                    winston.info(`[stream] beginning stream via download url`, this.logInfo);
                    let hasResolved = false;
                    httpRequest
                        .get(url, { timeout })
                        .on("error", (err) => {
                        if (hasResolved && err.code === "ECONNRESET") {
                            winston.info(`[stream] ignoring ECONNRESET that occured after streaming finished`, this.logInfo);
                        }
                        else {
                            winston.error(`[stream] request stream error`, Object.assign(Object.assign({}, this.logInfo), { error: err.message, stack: err.stack }));
                            reject(err);
                        }
                    })
                        .on("finish", () => {
                        winston.info(`[stream] streaming via download url finished`, this.logInfo);
                    })
                        .on("socket", (socket) => {
                        winston.info(`[stream] setting keepalive on socket`, this.logInfo);
                        socket.setKeepAlive(true);
                    })
                        .on("abort", () => {
                        winston.info(`[stream] streaming via download url aborted`, this.logInfo);
                    })
                        .on("response", () => {
                        winston.info(`[stream] got response from download url`, this.logInfo);
                    })
                        .on("close", () => {
                        winston.info(`[stream] request stream closed`, this.logInfo);
                    })
                        .pipe(stream)
                        .on("error", (err) => {
                        winston.error(`[stream] PassThrough stream error`, Object.assign({}, this.logInfo));
                        reject(err);
                    })
                        .on("finish", () => {
                        winston.info(`[stream] PassThrough stream finished`, this.logInfo);
                        resolve();
                        hasResolved = true;
                    })
                        .on("close", () => {
                        winston.info(`[stream] PassThrough stream closed`, this.logInfo);
                    });
                }
                else {
                    if (this.attachment && this.attachment.dataBuffer) {
                        winston.info(`Using "fake" streaming because request contained attachment data.`, this.logInfo);
                        winston.info(`DataBuffer: ${this.attachment.dataBuffer.length}`);
                        stream.write(this.attachment.dataBuffer);
                        stream.end();
                        resolve();
                    }
                    else {
                        stream.end();
                        reject("startStream was called on an ActionRequest that does not have" +
                            "a streaming download url or an attachment. Ensure usesStreaming is set properly on the action.");
                    }
                }
            });
            const results = yield Promise.all([returnPromise, streamPromise])
                .catch((err) => {
                winston.error(`Error caught awaiting for results. Error: ${err.toString()}`, this.logInfo);
                throw err;
            });
            return results[0];
        });
    }
    /**
     * A streaming helper for the "json" data format. It handles automatically parsing
     * the JSON in a streaming fashion. You just need to implement a function that will
     * be called for each row.
     *
     * ```ts
     * await request.streamJson((row) => {
     *   // This will be called for each row of data
     * })
     * ```
     *
     * @returns A promise that will be resolved when streaming is complete.
     * @param onRow A function that will be called for each streamed row, with the row as the first argument.
     */
    streamJson(onRow) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let rows = 0;
                this.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                    oboe(readable)
                        .node("![*]", this.safeOboe(readable, reject, (row) => {
                        rows++;
                        onRow(row);
                    }))
                        .done(() => {
                        winston.info(`[streamJson] oboe reports done`, Object.assign(Object.assign({}, this.logInfo), { rows }));
                    });
                })).then(() => {
                    winston.info(`[streamJson] complete`, Object.assign(Object.assign({}, this.logInfo), { rows }));
                    resolve();
                }).catch((error) => {
                    // This error should not be logged as it could come from an action
                    // which might decide to include user information in the error message
                    winston.info(`[streamJson] reported an error`, Object.assign(Object.assign({}, this.logInfo), { rows }));
                    reject(error);
                });
            });
        });
    }
    /**
     * A streaming helper for the "json_detail" data format. It handles automatically parsing
     * the JSON in a streaming fashion. You can implement an `onFields` callback to get
     * the field metadata, and an `onRow` callback for each row of data.
     *
     * ```ts
     * await request.streamJsonDetail({
     *   onFields: (fields) => {
     *     // This will be called when fields are available
     *   },
     *   onRow: (row) => {
     *     // This will be called for each row of data
     *   },
     * })
     * ```
     *
     * @returns A promise that will be resolved when streaming is complete.
     * @param callbacks An object consisting of several callbacks that will be called
     * when various parts of the data are parsed.
     */
    streamJsonDetail(callbacks) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                let rows = 0;
                this.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                    oboe(readable)
                        .node("!.data.*", this.safeOboe(readable, reject, (row) => {
                        rows++;
                        callbacks.onRow(row);
                    }))
                        .node("!.fields", this.safeOboe(readable, reject, (fields) => {
                        if (callbacks.onFields) {
                            callbacks.onFields(fields);
                        }
                    }))
                        .node("!.ran_at", this.safeOboe(readable, reject, (ranAt) => {
                        if (callbacks.onRanAt) {
                            callbacks.onRanAt(ranAt);
                        }
                    }))
                        .done(() => {
                        winston.info(`[streamJsonDetail] oboe reports done`, Object.assign(Object.assign({}, this.logInfo), { rows }));
                    });
                })).then(() => {
                    winston.info(`[streamJsonDetail] complete`, Object.assign(Object.assign({}, this.logInfo), { rows }));
                    resolve();
                }).catch((error) => {
                    // This error should not be logged as it could come from an action
                    // which might decide to include user information in the error message
                    winston.info(`[streamJsonDetail] reported an error`, Object.assign(Object.assign({}, this.logInfo), { rows }));
                    reject(error);
                });
            });
        });
    }
    suggestedFilename() {
        if (this.attachment) {
            if (this.scheduledPlan && this.scheduledPlan.title) {
                return sanitizeFilename(`${this.scheduledPlan.title}.${this.attachment.fileExtension}`);
            }
            else {
                return sanitizeFilename(`looker_file_${Date.now()}.${this.attachment.fileExtension}`);
            }
        }
        else if (this.formParams.format) {
            if (this.scheduledPlan && this.scheduledPlan.title) {
                return sanitizeFilename(`${this.scheduledPlan.title}.${(0, utils_1.formatToFileExtension)(this.formParams.format)}`);
            }
            else {
                return sanitizeFilename(`looker_file_${Date.now()}.${(0, utils_1.formatToFileExtension)(this.formParams.format)}`);
            }
        }
        winston.warn("Couldn't infer file extension from action request, using default filename scheme");
        return sanitizeFilename(`looker_file_${Date.now()}`);
    }
    /** Returns filename with whitespace removed and the file extension included
     */
    completeFilename() {
        if (this.attachment && this.formParams.filename) {
            if (this.formParams.filename.endsWith(this.attachment.fileExtension)) {
                return this.formParams.filename.trim().replace(/\s/g, "_");
            }
            else if (this.formParams.filename.indexOf(".") !== -1) {
                return this.suggestedFilename();
            }
            else {
                return `${this.formParams.filename.trim().replace(/\s/g, "_")}.${this.attachment.fileExtension}`;
            }
        }
        return this.formParams.filename;
    }
    /** creates a truncated message with a max number of lines and max number of characters with Title, Url,
     * and truncated Body of payload
     * @param {number} maxLines - maximum number of lines to truncate message
     * @param {number} maxCharacters - maximum character to truncate
     */
    suggestedTruncatedMessage(maxLines, maxCharacters) {
        if (this.attachment && this.attachment.dataBuffer) {
            let title = "";
            let url = "";
            if (this.scheduledPlan) {
                if (this.scheduledPlan.title) {
                    title = `${this.scheduledPlan.title}:\n`;
                }
                if (this.scheduledPlan.url) {
                    url = this.scheduledPlan.url;
                    title = title + url + "\n";
                }
            }
            const truncatedLines = this.attachment.dataBuffer
                .toString("utf8")
                .split("\n")
                .slice(0, maxLines);
            if (truncatedLines.length === maxLines) {
                truncatedLines.push("");
            }
            const newMessage = truncatedLines.join("\n");
            let body = title + newMessage;
            body = (0, utils_1.truncateString)(body, maxCharacters);
            return body;
        }
    }
    get logInfo() {
        return { webhookId: this.webhookId };
    }
    safeOboe(stream, reject, callback) {
        const logInfo = this.logInfo;
        return function (node) {
            try {
                callback(node);
                return oboe.drop;
            }
            catch (e) {
                winston.info(`safeOboe callback produced an error, aborting stream`, logInfo);
                this.abort();
                stream.destroy();
                reject(e);
            }
        };
    }
}
exports.ActionRequest = ActionRequest;
