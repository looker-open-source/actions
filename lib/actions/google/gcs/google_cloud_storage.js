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
const Hub = require("../../../hub");
const storage = require("@google-cloud/storage");
const FILE_EXTENSION = new RegExp(/(.*)\.(.*)$/);
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
            if (!request.formParams.bucket) {
                throw "Need Google Cloud Storage bucket.";
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
                throw new Error("Couldn't determine filename.");
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
                return new Hub.ActionResponse({ success: false, message: e.message });
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
                return form;
            }
            if (!(results && results[0] && results[0][0])) {
                form.error = "No buckets in account.";
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
