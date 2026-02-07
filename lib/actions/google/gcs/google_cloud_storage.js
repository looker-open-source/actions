"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleCloudStorageAction = void 0;
const winston = require("winston");
const http_errors_1 = require("../../../error_types/http_errors");
const utils_1 = require("../../../error_types/utils");
const Hub = require("../../../hub");
const action_response_1 = require("../../../hub/action_response");
const { Storage } = require("@google-cloud/storage");
const FILE_EXTENSION = new RegExp(/(.*)\.(.*)$/);
const LOG_PREFIX = "[Google Cloud Storage]";
class GoogleCloudStorageAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "google_cloud_storage";
        this.label = "Google Cloud Storage";
        this.iconName = "google/gcs/google_cloud_storage.svg";
        this.description = "Write data files to a Google Cloud Storage bucket.";
        this.supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query];
        this.usesStreaming = true;
        this.requiredFields = [];
        this.params = [
            {
                name: "client_email",
                label: "Client Email",
                required: true,
                sensitive: false,
                description: "Your client email for GCS from https://console.cloud.google.com/apis/credentials",
            }, {
                name: "private_key",
                label: "Private Key",
                required: true,
                sensitive: true,
                description: "Your private key for GCS from https://console.cloud.google.com/apis/credentials",
            }, {
                name: "project_id",
                label: "Project Id",
                required: true,
                sensitive: false,
                description: "The Project Id for your GCS project from https://console.cloud.google.com/apis/credentials",
            }, {
                name: "authorized_buckets",
                label: "Authorized Buckets",
                required: true,
                sensitive: false,
                description: "List of authorized Buckets for the Users (semicolon separated)",
            }
        ];
    }
    async execute(request) {
        var _a, _b;
        const response = new Hub.ActionResponse();
        if (!request.formParams.bucket) {
            const error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} needs a GCS bucket specified.`);
            response.success = false;
            response.error = error;
            response.message = error.message;
            response.webhookId = request.webhookId;
            winston.error(`${error.message}`, { error, webhookId: request.webhookId });
            return response;
        }
        const selectedBucket = request.formParams.bucket;
        const authorizedBuckets = (request.params.authorized_buckets || "")
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        if (authorizedBuckets.length === 0) {
            const error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} No buckets are authorized for use. Selected bucket "${selectedBucket}" cannot be used.`);
            response.success = false;
            response.error = error;
            response.message = error.message;
            response.webhookId = request.webhookId;
            winston.error(`${error.message}`, { error, webhookId: request.webhookId });
            return response;
        }
        if (!authorizedBuckets.includes(selectedBucket)) {
            const error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} Selected bucket "${selectedBucket}" is not in the list of authorized buckets.`);
            response.success = false;
            response.error = error;
            response.message = error.message;
            response.webhookId = request.webhookId;
            winston.error(`${error.message}`, { error, webhookId: request.webhookId });
            return response;
        }
        let filename = request.formParams.filename || request.suggestedFilename();
        // If the overwrite formParam exists and it is "no" - ensure a timestamp is appended
        if (request.formParams.overwrite && request.formParams.overwrite === "no") {
            const captures = filename.match(FILE_EXTENSION);
            if (captures && captures.length > 1) {
                filename = captures[1] + `_${Date.now()}.` + captures[2];
            }
            else {
                filename += `_${Date.now()}`;
            }
        }
        if (!filename) {
            const error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} request did not contain filename, or invalid filename was provided.`);
            response.success = false;
            response.error = error;
            response.message = error.message;
            response.webhookId = request.webhookId;
            winston.error(`${error.message}`, { error, webhookId: request.webhookId });
            return response;
        }
        const gcs = this.gcsClientFromRequest(request);
        const file = gcs.bucket(request.formParams.bucket)
            .file(filename);
        const writeStream = file.createWriteStream({
            metadata: {
                contentType: (_b = (_a = request.attachment) === null || _a === void 0 ? void 0 : _a.mime) !== null && _b !== void 0 ? _b : "application/octet-stream",
            },
        });
        try {
            await request.stream(async (readable) => {
                return new Promise((resolve, reject) => {
                    readable.pipe(writeStream)
                        .on("error", (error) => {
                        winston.error(`${LOG_PREFIX} Stream error: ${error.message}`, { error, webhookId: request.webhookId });
                        writeStream.end(); // Ensure stream is closed after an error
                        reject(error);
                    })
                        .on("finish", resolve);
                });
            });
            return new Hub.ActionResponse({ success: true });
        }
        catch (e) {
            const errorType = (0, utils_1.getHttpErrorType)(e, this.name);
            const error = (0, action_response_1.errorWith)(errorType, `${LOG_PREFIX} ${e.message}`);
            response.success = false;
            response.error = error;
            response.message = error.message;
            response.webhookId = request.webhookId;
            winston.error(`${LOG_PREFIX} Error uploading file. Error: ${error.message}`, {
                error,
                webhookId: request.webhookId,
            });
            return response;
        }
    }
    async form(request) {
        const form = new Hub.ActionForm();
        const gcs = this.gcsClientFromRequest(request);
        let results;
        try {
            results = await gcs.getBuckets();
        }
        catch (e) {
            form.error = `An error occurred while fetching the bucket list.

      Your Google Cloud Storage credentials may be incorrect.

      Google SDK Error: "${e.message}"`;
            winston.error(`${LOG_PREFIX} An error occurred while fetching the bucket list. Google SDK Error: ${e.message} `, { webhookId: request.webhookId });
            return form;
        }
        if (!(results && results[0] && results[0][0])) {
            form.error = "No buckets in account.";
            winston.error(`${LOG_PREFIX} No buckets in account`, { webhookId: request.webhookId });
            return form;
        }
        const allBuckets = results[0];
        const authorizedBuckets = (request.params.authorized_buckets || "")
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        const filteredBuckets = allBuckets.filter((b) => authorizedBuckets.includes(b.name));
        if (filteredBuckets.length === 0) {
            form.error = "None of the authorized buckets were found in your GCS account.";
            winston.error(`${LOG_PREFIX} No authorized buckets found`, { webhookId: request.webhookId });
            return form;
        }
        form.fields = [{
                label: "Bucket",
                name: "bucket",
                required: true,
                options: filteredBuckets.map((b) => {
                    return { name: b.id, label: b.name };
                }),
                default: filteredBuckets[0].id,
                type: "select",
            }, {
                label: "Filename",
                name: "filename",
                type: "string",
            }, {
                label: "Overwrite",
                name: "overwrite",
                options: [{ label: "Yes", name: "yes" }, { label: "No", name: "no" }],
                default: "yes",
                description: "If Overwrite is enabled, will use the title or filename and overwrite existing data." +
                    " If disabled, a date time will be appended to the name to make the file unique.",
            }];
        return form;
    }
    gcsClientFromRequest(request) {
        const credentials = {
            client_email: request.params.client_email,
            private_key: request.params.private_key.replace(/\\n/g, "\n"),
        };
        return new Storage({
            projectId: request.params.project_id,
            credentials,
            apiEndpoint: "https://storage.googleapis.com",
            useAuthWithCustomEndpoint: true,
        });
    }
}
exports.GoogleCloudStorageAction = GoogleCloudStorageAction;
Hub.addAction(new GoogleCloudStorageAction());
