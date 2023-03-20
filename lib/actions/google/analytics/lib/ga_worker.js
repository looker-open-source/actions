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
exports.GoogleAnalyticsActionWorker = void 0;
const googleapis_1 = require("googleapis");
const Hub = require("../../../../hub");
const missing_auth_error_1 = require("../../common/missing_auth_error");
const missing_required_params_error_1 = require("../../common/missing_required_params_error");
const utils_1 = require("../../common/utils");
const csv_header_transform_stream_1 = require("./csv_header_transform_stream");
class GoogleAnalyticsActionWorker {
    static fromHubRequest(hubRequest, actionInstance, logger) {
        return __awaiter(this, void 0, void 0, function* () {
            const gaWorker = new GoogleAnalyticsActionWorker(hubRequest, actionInstance, logger);
            return gaWorker;
        });
    }
    constructor(hubRequest, actionInstance, log) {
        this.hubRequest = hubRequest;
        this.actionInstance = actionInstance;
        this.log = log;
        const tmpState = (0, utils_1.safeParseJson)(hubRequest.params.state_json);
        if (!tmpState || !tmpState.tokens || !tmpState.redirect) {
            throw new missing_auth_error_1.MissingAuthError("User state was missing or did not contain tokens & redirect");
        }
        this.userState = tmpState;
        this.formParams = hubRequest.formParams;
        this.gaClient = this.makeGAClient();
    }
    makeGAClient() {
        const oauthClient = this.actionInstance.makeOAuthClient(this.redirect);
        oauthClient.setCredentials(this.tokens);
        return googleapis_1.google.analytics({ version: "v3", auth: oauthClient });
    }
    get redirect() {
        return this.userState.redirect;
    }
    get tokens() {
        return this.userState.tokens;
    }
    get dataSourceCompositeId() {
        if (!this.formParams.dataSourceCompositeId) {
            throw new missing_required_params_error_1.MissingRequiredParamsError("Did not receive required form param 'dataSourceCompositeId'");
        }
        return this.formParams.dataSourceCompositeId;
    }
    get dataSourceSchema() {
        if (!this.formParams.dataSourceSchema) {
            throw new missing_required_params_error_1.MissingRequiredParamsError("Did not receive required form param 'dataSourceSchema'");
        }
        return this.formParams.dataSourceSchema;
    }
    get isDeleteOtherFiles() {
        return Boolean(this.newUploadId && this.formParams.deleteOtherFiles === "yes");
    }
    get lastUsedFormParams() {
        return this.userState.lastUsedFormParams ? this.userState.lastUsedFormParams : {};
    }
    getEntityIds() {
        return this.dataSourceCompositeId.split("::");
    }
    setLastUsedFormParams() {
        this.userState.lastUsedFormParams = this.formParams;
    }
    uploadData() {
        return __awaiter(this, void 0, void 0, function* () {
            const [accountId, propertyId, dataSourceId] = this.getEntityIds();
            const csvHeader = this.dataSourceSchema;
            return this.hubRequest.stream((downloadStream) => __awaiter(this, void 0, void 0, function* () {
                const csvStream = new csv_header_transform_stream_1.CsvHeaderTransformStream(csvHeader);
                downloadStream
                    .pipe(csvStream)
                    .on("error", (err) => {
                    this.log("error", "[stream] csv transform stream error:", err.toString());
                    this.log("error", "[stream] csv transform stream error JSON:", JSON.stringify(err));
                })
                    .on("finish", () => {
                    this.log("info", "[stream] csv transform stream finished");
                })
                    .on("close", () => {
                    this.log("info", "[stream] csv transform stream closed");
                });
                const uploadParams = {
                    accountId,
                    customDataSourceId: dataSourceId,
                    webPropertyId: propertyId,
                    /*
                    requestBody: {
                      title: "My Filename Here"
                      // Setting a filename is not currently supported by this library
                      // although this is where it would go.
                      // https://github.com/googleapis/google-api-nodejs-client/issues/2339
                    }, */
                    media: {
                        mimeType: "application/octet-stream",
                        body: csvStream,
                    },
                };
                const uploadResponse = yield this.gaClient.management.uploads.uploadData(uploadParams);
                this.newUploadId = uploadResponse.data.id;
            }));
        });
    }
    deleteOtherFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const [accountId, propertyId, dataSourceId] = this.getEntityIds();
            if (this.formParams.deleteOtherFiles !== "yes") {
                throw new Error("Failed sanity check:"
                    + " we are in the delete uploads method but the deleteOtherFiles param is not 'yes'.");
            }
            if (!this.newUploadId) {
                throw new Error("Failed sanity check: we are in the delete uploads method but there is no 'newUploadId'.");
            }
            const allUploadsResp = yield this.gaClient.management.uploads.list({
                accountId,
                customDataSourceId: dataSourceId,
                webPropertyId: propertyId,
            });
            const allUploads = allUploadsResp.data;
            if (!allUploads.items) {
                this.log("warn", "No uploads found. That shouldn't happen because we only do this query after a successful upload.");
                return;
            }
            const idsToDelete = [];
            for (const upload of allUploads.items) {
                if (upload.id && upload.id !== this.newUploadId) {
                    idsToDelete.push(upload.id);
                }
            }
            this.log("info", `Deleting ${idsToDelete.length} uploads from GA`);
            return this.gaClient.management.uploads.deleteUploadData({
                accountId,
                customDataSourceId: dataSourceId,
                webPropertyId: propertyId,
                requestBody: {
                    customDataImportUids: idsToDelete,
                },
            });
        });
    }
    makeForm() {
        return __awaiter(this, void 0, void 0, function* () {
            const accountSummariesResp = yield this.gaClient.management.accountSummaries.list();
            const accountSummariesData = accountSummariesResp.data;
            const username = accountSummariesData.username;
            const accountSummaries = accountSummariesData.items ? accountSummariesData.items : [];
            const dataSetSelectOptions = yield this.getDataSetSelectOptions(accountSummaries);
            const { lastUsedCompositeId, lastUsedSchema, lastUsedDeleteOtherFiles } = this.lastUsedFormParams;
            const form = new Hub.ActionForm();
            /* This is supposed to work at some point, considering interface ActionFormFieldMessage
            form.fields.push({
              name: "message",
              type: "message",
              value: "This destination will upload the Looker report to the Google Analytics custom data set chosen below."
                + " The number of columns and their order should match the data set schema exactly."
                + " Be sure to check whether you want 'Results in Table' or 'All Results';"
                + " this destination supports streaming, but GA uploads are limited to 1gb file size."
                + ` You are currently logged in as "${username}"`
            })
            */
            form.fields.push({
                name: "dataSourceCompositeId",
                label: "Data Set",
                type: "select",
                description: `Account Name >> Property Name >> Data Set. You are currently logged in as ${username}`,
                options: dataSetSelectOptions,
                default: lastUsedCompositeId ? lastUsedCompositeId : "",
                required: true,
            });
            form.fields.push({
                name: "dataSourceSchema",
                label: "Data Set Schema",
                type: "string",
                description: "Get this value from the Data Set definition in GA."
                    + " The format is like \"ga:dimension1,ga:dimension2\" without quotes.",
                default: lastUsedSchema ? lastUsedSchema : "",
                required: true,
            });
            form.fields.push({
                name: "deleteOtherFiles",
                label: "Delete Other Files?",
                type: "select",
                description: "If 'Yes', then all other files in the data set will be deleted after this upload is complete.",
                options: [{ name: "yes", label: "Yes" }, { name: "no", label: "No" }],
                default: lastUsedDeleteOtherFiles ? lastUsedDeleteOtherFiles : "",
                required: true,
            });
            return form;
        });
    }
    getDataSetSelectOptions(accountSummaries) {
        return __awaiter(this, void 0, void 0, function* () {
            /*
             * We are given a list of all Accounts the user belongs to with a nested array of WebProperties in that account.
             * This is the only place where we get the account names & property names.
             * The Data Sources can only be fetched on a per-property basis.
             * So we start by flattening the account summaries into a map of {propertyId => account info}
             * Later we will join this into the data source info.
             */
            const propertyInfoMap = new Map();
            for (const accountSummary of accountSummaries) {
                if (!accountSummary.webProperties || !accountSummary.id || !accountSummary.name) {
                    continue;
                }
                for (const webProperty of accountSummary.webProperties) {
                    if (!webProperty.id || !webProperty.name) {
                        continue;
                    }
                    propertyInfoMap.set(webProperty.id, {
                        accountId: accountSummary.id,
                        accountName: accountSummary.name,
                        propertyName: webProperty.name,
                    });
                }
            }
            // Result: Map( propertyId => {accountId, accountName, propertyName}, propertyId => {...} )
            // TypeScript complains about mapClassObj.entries().map()
            // Using workaround given here:
            //    https://github.com/microsoft/TypeScript/issues/6842#issuecomment-355441797
            const dataSourcesPromises = Array.from(propertyInfoMap, ([propertyId, info]) => __awaiter(this, void 0, void 0, function* () {
                // After user testing we discovered that there are some permission setups that can cause this
                // call to fail (user is unable to list data sources for an account).
                // So we just skip those properties if that is the case
                return this.gaClient.management.customDataSources
                    .list({ accountId: info.accountId, webPropertyId: propertyId })
                    .catch((_) => null);
            }));
            const dataSourcesResponses = yield Promise.all(dataSourcesPromises);
            const dataSourcesByProperty = dataSourcesResponses.map((i) => i ? i.data : null);
            const flattenedResults = [];
            for (const elem of dataSourcesByProperty) {
                if (!elem || !elem.items) {
                    continue;
                }
                for (const dataSource of elem.items) {
                    if (!dataSource.accountId || !dataSource.webPropertyId) {
                        continue;
                    }
                    if (!dataSource.id || !dataSource.name) {
                        continue;
                    }
                    const propertyInfo = propertyInfoMap.get(dataSource.webPropertyId);
                    if (!propertyInfo) {
                        continue;
                    }
                    const newEntry = {
                        accountId: dataSource.accountId,
                        propertyId: dataSource.webPropertyId,
                        dataSourceId: dataSource.id,
                        accountName: propertyInfo.accountName,
                        propertyName: propertyInfo.propertyName,
                        dataSourceName: dataSource.name,
                    };
                    flattenedResults.push(newEntry);
                }
            }
            // Result: [ {accountId, accountName, propertyId, propertyName, dataSourceId, dataSourceName}, {...} ]
            const dataSourceSelectOptions = flattenedResults.map((entry) => {
                return {
                    name: `${entry.accountId}::${entry.propertyId}::${entry.dataSourceId}`,
                    label: `${entry.accountName} >> ${entry.propertyName} >> ${entry.dataSourceName}`,
                };
            });
            // Result: [ {name: "id::id:id", label: "A >> B >> C"}, {...} ]
            return dataSourceSelectOptions;
        });
    }
}
exports.GoogleAnalyticsActionWorker = GoogleAnalyticsActionWorker;
