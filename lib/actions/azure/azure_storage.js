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
exports.AzureStorageAction = void 0;
const Hub = require("../../hub");
const azure = require("azure-storage");
class AzureStorageAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "azure_storage";
        this.label = "Azure Storage";
        this.iconName = "azure/azure_storage.png";
        this.description = "Write data files to an Azure container.";
        this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard];
        this.usesStreaming = true;
        this.requiredFields = [];
        this.params = [
            {
                name: "account",
                label: "Storage Account",
                required: true,
                sensitive: false,
                description: "Your account for Azure.",
            }, {
                name: "accessKey",
                label: "Access Key",
                required: true,
                sensitive: true,
                description: "Your access key for Azure.",
            },
        ];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!request.formParams.container) {
                throw "Need Azure container.";
            }
            const fileName = request.formParams.filename || request.suggestedFilename();
            const container = request.formParams.container;
            if (!fileName) {
                return new Hub.ActionResponse({ success: false, message: "Cannot determine a filename." });
            }
            const blobService = this.azureClientFromRequest(request);
            const writeStream = blobService.createWriteStreamToBlockBlob(container, fileName);
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
            // error in type definition for listContainersSegmented currentToken?
            // https://github.com/Azure/azure-storage-node/issues/352
            const form = new Hub.ActionForm();
            const blobService = this.azureClientFromRequest(request);
            return new Promise((resolve, _reject) => {
                blobService.listContainersSegmented(null, (err, res) => {
                    if (err) {
                        form.error = err;
                        resolve(form);
                    }
                    else {
                        const entries = res.entries;
                        if (entries.length > 0) {
                            form.fields = [{
                                    label: "Container",
                                    name: "container",
                                    required: true,
                                    options: entries.map((c) => {
                                        return { name: c.name, label: c.name };
                                    }),
                                    type: "select",
                                    default: entries[0].name,
                                }, {
                                    label: "Filename",
                                    name: "filename",
                                    type: "string",
                                }];
                            resolve(form);
                        }
                        else {
                            form.error = "Create a container in your Azure account.";
                            resolve(form);
                        }
                    }
                });
            });
        });
    }
    azureClientFromRequest(request) {
        try {
            return azure.createBlobService(request.params.account, request.params.accessKey);
        }
        catch (err) {
            if (err && err.toString().includes("base64")) {
                throw "The provided Account Key is not a valid base64 string";
            }
            throw "Error making Azure client. Storage Account and Access Key settings may be incorrect";
        }
    }
}
exports.AzureStorageAction = AzureStorageAction;
Hub.addAction(new AzureStorageAction());
