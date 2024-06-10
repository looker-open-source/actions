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
exports.GoogleCloudStorageAction = void 0;
const winston = require("winston");
const http_errors_1 = require("../../../error_types/http_errors");
const utils_1 = require("../../../error_types/utils");
const Hub = require("../../../hub");
const action_response_1 = require("../../../hub/action_response");
const storage = require("@google-cloud/storage");
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
            },
        ];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = new Hub.ActionResponse();
            if (!request.formParams.bucket) {
                const error = {
                    http_code: http_errors_1.HTTP_ERROR.bad_request.code,
                    status_code: http_errors_1.HTTP_ERROR.bad_request.status,
                    message: `${http_errors_1.HTTP_ERROR.bad_request.description} ${LOG_PREFIX} needs a GCS bucket specified.`,
                    location: "ActionContainer",
                    documentation_url: "TODO",
                };
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
                const error = {
                    http_code: http_errors_1.HTTP_ERROR.bad_request.code,
                    status_code: http_errors_1.HTTP_ERROR.bad_request.status,
                    message: `${http_errors_1.HTTP_ERROR.bad_request.description} ${LOG_PREFIX} request did not contain filename, or invalid filename was provided.`,
                    location: "ActionContainer",
                    documentation_url: "TODO",
                };
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
            const writeStream = file.createWriteStream();
            try {
                yield request.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                    return new Promise((resolve, reject) => {
                        readable.pipe(writeStream)
                            .on("error", reject)
                            .on("finish", resolve);
                    });
                }));
                return new Hub.ActionResponse({ success: true });
            }
            catch (e) {
                let error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.internal, `${LOG_PREFIX} Error while sending data ${e.message}`);
                if (e.code) {
                    const errorType = (0, utils_1.getHttpErrorType)(e.code);
                    error = (0, action_response_1.errorWith)(errorType, `${errorType.description} ${LOG_PREFIX} ${e.message}`);
                }
                response.success = false;
                response.error = error;
                response.message = error.message;
                response.webhookId = request.webhookId;
                winston.error(`${LOG_PREFIX} ${error.message}`, { error, webhookId: request.webhookId });
                return response;
            }
        });
    }
    form(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            const gcs = this.gcsClientFromRequest(request);
            let results;
            try {
                results = yield gcs.getBuckets();
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
            const buckets = results[0];
            form.fields = [{
                    label: "Bucket",
                    name: "bucket",
                    required: true,
                    options: buckets.map((b) => {
                        return { name: b.id, label: b.name };
                    }),
                    type: "select",
                    default: buckets[0].id,
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
        });
    }
    gcsClientFromRequest(request) {
        const credentials = {
            client_email: request.params.client_email,
            private_key: request.params.private_key.replace(/\\n/g, "\n"),
        };
        const config = {
            projectId: request.params.project_id,
            credentials,
        };
        return new storage(config);
    }
}
exports.GoogleCloudStorageAction = GoogleCloudStorageAction;
Hub.addAction(new GoogleCloudStorageAction());
