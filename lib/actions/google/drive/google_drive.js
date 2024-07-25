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
exports.GoogleDriveAction = void 0;
const https = require("request-promise-native");
const googleapis_1 = require("googleapis");
const winston = require("winston");
const http_errors_1 = require("../../../error_types/http_errors");
const utils_1 = require("../../../error_types/utils");
const Hub = require("../../../hub");
const action_response_1 = require("../../../hub/action_response");
const LOG_PREFIX = "[GOOGLE_DRIVE]";
class GoogleDriveAction extends Hub.OAuthAction {
    constructor() {
        super(...arguments);
        this.name = "google_drive";
        this.label = "Google Drive";
        this.iconName = "google/drive/google_drive.svg";
        this.description = "Create a new file in Google Drive.";
        this.supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query];
        this.usesStreaming = true;
        this.minimumSupportedLookerVersion = "7.3.0";
        this.requiredFields = [];
        this.params = [];
        this.mimeType = undefined;
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = new Hub.ActionResponse();
            if (!request.params.state_json) {
                resp.success = false;
                resp.state = new Hub.ActionState();
                resp.state.data = "reset";
                return resp;
            }
            const stateJson = JSON.parse(request.params.state_json);
            if (stateJson.tokens && stateJson.redirect) {
                const drive = yield this.driveClientFromRequest(stateJson.redirect, stateJson.tokens);
                const filename = request.formParams.filename || request.suggestedFilename();
                if (!filename) {
                    const error = (0, action_response_1.errorWith)(http_errors_1.HTTP_ERROR.bad_request, `${LOG_PREFIX} Error creating filename from request`);
                    resp.success = false;
                    resp.error = error;
                    resp.message = error.message;
                    resp.webhookId = request.webhookId;
                    winston.error(`${error.message}`, { error, webhookId: request.webhookId });
                    return resp;
                }
                try {
                    yield this.sendData(filename, request, drive);
                    resp.success = true;
                }
                catch (e) {
                    const errorType = (0, utils_1.getHttpErrorType)(e, this.name);
                    let error = (0, action_response_1.errorWith)(errorType, `${LOG_PREFIX} ${e.message}`);
                    if (e.code && e.errors && e.errors[0] && e.errors[0].message) {
                        error = Object.assign(Object.assign({}, error), { http_code: e.code, message: `${errorType.description} ${LOG_PREFIX} ${e.errors[0].message}` });
                    }
                    resp.success = false;
                    resp.message = e.message;
                    resp.webhookId = request.webhookId;
                    resp.error = error;
                    winston.error(`${error.message}`, { error, webhookId: request.webhookId });
                }
            }
            else {
                resp.success = false;
                resp.state = new Hub.ActionState();
                resp.state.data = "reset";
            }
            return resp;
        });
    }
    form(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (request.params.state_json) {
                try {
                    const stateJson = JSON.parse(request.params.state_json);
                    if (stateJson.tokens && stateJson.redirect) {
                        const drive = yield this.driveClientFromRequest(stateJson.redirect, stateJson.tokens);
                        const form = new Hub.ActionForm();
                        const driveSelections = yield this.getDrives(drive);
                        form.fields.push({
                            description: "Google Drive where your file will be saved",
                            label: "Select Drive to save file",
                            name: "drive",
                            options: driveSelections,
                            default: driveSelections[0].name,
                            interactive: true,
                            required: true,
                            type: "select",
                        });
                        form.fields.push({
                            description: "Google Drive folder where your file will be saved",
                            label: "Enter the folder name to save file",
                            name: "folder",
                            required: true,
                            type: "string",
                        });
                        form.fields.push({
                            label: "Enter a name",
                            name: "filename",
                            type: "string",
                            required: true,
                        });
                        form.state = new Hub.ActionState();
                        form.state.data = JSON.stringify({ tokens: stateJson.tokens, redirect: stateJson.redirect });
                        return form;
                    }
                }
                catch (e) {
                    winston.error("Can not sign in to Google", { webhookId: request.webhookId });
                }
            }
            return this.loginForm(request);
        });
    }
    oauthUrl(redirectUri, encryptedState) {
        return __awaiter(this, void 0, void 0, function* () {
            const oauth2Client = this.oauth2Client(redirectUri);
            winston.info(redirectUri);
            // generate a url that asks permissions for Google Drive scope
            const scopes = [
                "https://www.googleapis.com/auth/drive",
            ];
            const url = oauth2Client.generateAuthUrl({
                access_type: "offline",
                scope: scopes,
                prompt: "consent",
                state: encryptedState,
            });
            return url.toString();
        });
    }
    oauthFetchInfo(urlParams, redirectUri) {
        return __awaiter(this, void 0, void 0, function* () {
            const actionCrypto = new Hub.ActionCrypto();
            const plaintext = yield actionCrypto.decrypt(urlParams.state).catch((err) => {
                winston.error("Encryption not correctly configured" + err);
                throw err;
            });
            const tokens = yield this.getAccessTokenCredentialsFromCode(redirectUri, urlParams.code);
            // Pass back context to Looker
            const payload = JSON.parse(plaintext);
            yield https.post({
                url: payload.stateurl,
                body: JSON.stringify({ tokens, redirect: redirectUri }),
            }).catch((_err) => { winston.error(_err.toString()); });
        });
    }
    oauthCheck(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (request.params.state_json) {
                const stateJson = JSON.parse(request.params.state_json);
                if (stateJson.tokens && stateJson.redirect) {
                    const drive = yield this.driveClientFromRequest(stateJson.redirect, stateJson.tokens);
                    yield drive.files.list({
                        pageSize: 10,
                    });
                    return true;
                }
            }
            return false;
        });
    }
    oauth2Client(redirectUri) {
        return new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_DRIVE_CLIENT_ID, process.env.GOOGLE_DRIVE_CLIENT_SECRET, redirectUri);
    }
    sendData(filename, request, drive) {
        return __awaiter(this, void 0, void 0, function* () {
            const folderId = yield this.getFolderId(request, drive);
            const mimeType = this.getMimeType(request);
            const fileMetadata = {
                name: filename,
                mimeType,
                parents: folderId ? [folderId] : undefined,
            };
            return request.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                winston.info("Creating new file in Drive", { webhookId: request.webhookId });
                const driveParams = {
                    requestBody: fileMetadata,
                    media: {
                        body: readable,
                    },
                };
                if (request.formParams.drive !== undefined && request.formParams.drive !== "mydrive") {
                    driveParams.requestBody.driveId = request.formParams.drive;
                    driveParams.supportsAllDrives = true;
                }
                return drive.files.create(driveParams).catch((e) => {
                    winston.error(e.toString(), { webhookId: request.webhookId });
                    throw e;
                });
            }));
        });
    }
    getDrives(drive) {
        return __awaiter(this, void 0, void 0, function* () {
            const driveList = [{ name: "mydrive", label: "My Drive" }];
            const drives = yield drive.drives.list({
                pageSize: 50,
            });
            if (drives.data.drives) {
                drives.data.drives.forEach((d) => {
                    driveList.push({ name: d.id, label: d.name });
                });
            }
            return driveList;
        });
    }
    getMimeType(request) {
        if (this.mimeType) {
            return this.mimeType;
        }
        if (request.attachment && request.attachment.mime) {
            return request.attachment.mime;
        }
        switch (request.formParams.format) {
            case "csv":
                return "text/csv";
            case "xlsx":
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "inline_json":
                return "application/json";
            case "json":
                return "application/json";
            case "json_label":
                return "application/json";
            case "json_detail":
                return "application/json";
            case "html":
                return "text/html";
            case "txt":
                return "text/plain";
            default:
                return undefined;
        }
    }
    sanitizeGaxiosError(err) {
        const configObjs = [];
        if (err.config) {
            configObjs.push(err.config);
        }
        if (err.response && err.response.config) {
            configObjs.push(err.response.config);
        }
        for (const config of configObjs) {
            for (const prop of ["data", "body"]) {
                if (config[prop]) {
                    config[prop] = "[REDACTED]";
                }
            }
        }
    }
    getFolderId(request, drive) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                let nextPageToken = null;
                let folderId = "root";
                // drive.files.list() options
                const options = {
                    fields: "files(id,name,parents),nextPageToken",
                    orderBy: "recency desc",
                    pageSize: 1000,
                    q: `mimeType='application/vnd.google-apps.folder' and trashed=false`,
                    spaces: "drive",
                };
                if (request.formParams.drive !== undefined && request.formParams.drive !== "mydrive") {
                    options.driveId = request.formParams.drive;
                    options.includeItemsFromAllDrives = true;
                    options.supportsAllDrives = true;
                    options.corpora = "drive";
                }
                else {
                    options.corpora = "user";
                }
                do {
                    const response = yield drive.files.list(Object.assign(Object.assign({}, options), { pageToken: nextPageToken }));
                    if (response.data.files && response.data.files.length > 0) {
                        const files = response.data.files.filter((folder) => (!(folder.id === undefined) && !(folder.name === undefined) && folder.name === request.formParams.folder));
                        if (files.length > 0) {
                            folderId = files[0].id;
                            nextPageToken = null;
                            return folderId;
                        }
                    }
                    else {
                        nextPageToken = response.data.nextPageToken;
                    }
                } while (nextPageToken);
                return folderId;
            }
            catch (error) {
                winston.error(`${LOG_PREFIX} Can not get folder ID`, { webhookId: request.webhookId });
            }
        });
    }
    getAccessTokenCredentialsFromCode(redirect, code) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.oauth2Client(redirect);
            const { tokens } = yield client.getToken(code);
            return tokens;
        });
    }
    driveClientFromRequest(redirect, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.oauth2Client(redirect);
            client.setCredentials(tokens);
            return googleapis_1.google.drive({ version: "v3", auth: client });
        });
    }
    loginForm(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [];
            const actionCrypto = new Hub.ActionCrypto();
            const jsonString = JSON.stringify({ stateurl: request.params.state_url });
            const ciphertextBlob = yield actionCrypto.encrypt(jsonString).catch((err) => {
                winston.error("Encryption not correctly configured");
                throw err;
            });
            form.state = new Hub.ActionState();
            form.fields.push({
                name: "login",
                type: "oauth_link_google",
                label: "Log in",
                description: "In order to send to Google Drive, you will need to log in" +
                    " once to your Google account.",
                oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`,
            });
            winston.debug(`Login form, OAuthURL${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`);
            return form;
        });
    }
}
exports.GoogleDriveAction = GoogleDriveAction;
if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
    Hub.addAction(new GoogleDriveAction());
}
