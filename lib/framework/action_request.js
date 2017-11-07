"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sanitizeFilename = require("sanitize-filename");
const utils_1 = require("./utils");
class ActionRequest {
    constructor() {
        this.formParams = {};
        this.params = {};
    }
    static fromRequest(request) {
        const actionRequest = this.fromJSON(request.body);
        actionRequest.instanceId = request.header("x-looker-instance");
        actionRequest.webhookId = request.header("x-looker-webhook-id");
        return actionRequest;
    }
    static fromJSON(json) {
        if (!json) {
            throw "Request body must be valid JSON.";
        }
        const request = new ActionRequest();
        request.type = json.type;
        if (json && json.attachment) {
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
        if (json && json.scheduled_plan) {
            request.scheduledPlan = {
                filtersDifferFromLook: json.scheduled_plan.filters_differ_from_look,
                queryId: json.scheduled_plan.query_id,
                scheduledPlanId: json.scheduled_plan_id,
                title: json.scheduled_plan.title,
                type: json.scheduled_plan.type,
                url: json.scheduled_plan.url,
            };
        }
        if (json && json.data) {
            request.params = json.data;
        }
        if (json && json.form_params) {
            request.formParams = json.form_params;
        }
        return request;
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
            body = utils_1.truncateString(body, maxCharacters);
            return body;
        }
    }
}
exports.ActionRequest = ActionRequest;
