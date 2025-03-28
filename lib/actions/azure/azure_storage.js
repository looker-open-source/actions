"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AzureStorageAction = void 0;
const storage_blob_1 = require("@azure/storage-blob");
const Hub = require("../../hub");
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
    async execute(request) {
        if (!request.formParams.container) {
            throw "Need Azure container.";
        }
        const fileName = request.formParams.filename || request.suggestedFilename();
        const container = request.formParams.container;
        if (!fileName) {
            return new Hub.ActionResponse({ success: false, message: "Cannot determine a filename." });
        }
        const blobService = this.azureClientFromRequest(request);
        const containerClient = blobService.getContainerClient(container);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        try {
            await request.stream(async (readable) => {
                return blockBlobClient.uploadStream(readable);
            });
            return new Hub.ActionResponse({ success: true });
        }
        catch (e) {
            return new Hub.ActionResponse({ success: false, message: e.message });
        }
    }
    async form(request) {
        const form = new Hub.ActionForm();
        const blobService = this.azureClientFromRequest(request);
        return new Promise(async (resolve, _reject) => {
            for await (const response of blobService.listContainers().byPage()) {
                if (response.containerItems.length > 0) {
                    const entries = response.containerItems;
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
                }
                else {
                    form.error = "Create a container in your Azure account.";
                    resolve(form);
                }
            }
        });
    }
    azureClientFromRequest(request) {
        try {
            const sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(request.params.account, request.params.accessKey);
            return new storage_blob_1.BlobServiceClient(`https://${request.params.account}.blob.core.windows.net`, sharedKeyCredential);
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
