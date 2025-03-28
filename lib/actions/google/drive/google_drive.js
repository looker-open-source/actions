"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveAction = void 0;
const https = require("request-promise-native");
const googleapis_1 = require("googleapis");
const winston = require("winston");
const http_errors_1 = require("../../../error_types/http_errors");
const utils_1 = require("../../../error_types/utils");
const Hub = require("../../../hub");
const action_response_1 = require("../../../hub/action_response");
const domain_validator_1 = require("./domain_validator");
const LOG_PREFIX = "[GOOGLE_DRIVE]";
const FOLDERID_REGEX = /\/folders\/(?<folderId>[^\/?]+)/;
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
        this.params = [{
                name: "domain_allowlist",
                label: "Domain Allowlist",
                required: false,
                sensitive: false,
                description: "Comma separated domain allowlist ex: facts.com,car.com. Be advised that if this is enabled after, all existing accounts will have to reauth due to an additional scope needed to check the email address.",
            }];
        this.mimeType = undefined;
    }
    async execute(request) {
        const resp = new Hub.ActionResponse();
        if (!request.params.state_json) {
            resp.success = false;
            resp.state = new Hub.ActionState();
            resp.state.data = "reset";
            return resp;
        }
        const stateJson = JSON.parse(request.params.state_json);
        if (stateJson.tokens && stateJson.redirect) {
            await this.validateUserInDomainAllowlist(request.params.domain_allowlist, stateJson.redirect, stateJson.tokens, request.webhookId)
                .catch((error) => {
                winston.info(error + " - invalidating token", { webhookId: request.webhookId });
                resp.success = false;
                resp.state = new Hub.ActionState();
                resp.state.data = "reset";
                return resp;
            });
            const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens);
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
                await this.sendData(filename, request, drive);
                resp.success = true;
            }
            catch (e) {
                const errorType = (0, utils_1.getHttpErrorType)(e, this.name);
                let error = (0, action_response_1.errorWith)(errorType, `${LOG_PREFIX} ${e.message}`);
                if (e.code && e.errors && e.errors[0] && e.errors[0].message) {
                    error = {
                        ...error, http_code: e.code, message: `${errorType.description} ${LOG_PREFIX} ${e.errors[0].message}`,
                    };
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
    }
    async form(request) {
        const form = new Hub.ActionForm();
        if (request.params.state_json) {
            try {
                const stateJson = JSON.parse(request.params.state_json);
                if (stateJson.tokens && stateJson.redirect) {
                    await this.validateUserInDomainAllowlist(request.params.domain_allowlist, stateJson.redirect, stateJson.tokens, request.webhookId)
                        .catch((error) => {
                        winston.info(error + " - invalidating token", { webhookId: request.webhookId });
                        form.state = new Hub.ActionState();
                        form.state.data = "reset";
                        throw "Domain Verification Failed";
                    });
                    const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens);
                    const paginatedDrives = await this.getDrives(drive, [], await drive.drives.list({ pageSize: 50 }));
                    const driveSelections = paginatedDrives.filter((_drive) => (!(_drive.id === undefined) && !(_drive.name === undefined)))
                        .map((folder) => ({ name: folder.id, label: folder.name }));
                    driveSelections.unshift({ name: "mydrive", label: "My Drive" });
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
                    if (request.formParams.fetchpls) {
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
                        async function pagedFileList(accumulatedFiles, response) {
                            const mergedFiles = accumulatedFiles.concat(response.data.files);
                            // When a `nextPageToken` exists, recursively call this function to get the next page.
                            if (response.data.nextPageToken) {
                                const pageOptions = { ...options };
                                pageOptions.pageToken = response.data.nextPageToken;
                                return pagedFileList(mergedFiles, await drive.files.list(pageOptions));
                            }
                            return mergedFiles;
                        }
                        const paginatedFiles = await pagedFileList([], await drive.files.list(options));
                        const folders = paginatedFiles.filter((folder) => (!(folder.id === undefined) && !(folder.name === undefined)))
                            .map((folder) => ({ name: folder.id, label: folder.name }));
                        folders.unshift({ name: "root", label: "Drive Root" });
                        form.fields.push({
                            description: "Google Drive folder where your file will be saved",
                            label: "Select folder to save file",
                            name: "folder",
                            options: folders,
                            default: folders[0].name,
                            required: true,
                            type: "select",
                        });
                        // We did not fetch the folder, offer to fetch or to enter a folderid
                    }
                    else {
                        form.fields.push({
                            description: "Enter the full Google Drive URL of the folder where you want to save your data. It should look something like https://drive.google.com/corp/drive/folders/xyz. If this is inaccessible, your data will be saved to the root folder of your Google Drive. You do not need to enter a URL if you have already chosen a folder in the dropdown menu.\n",
                            label: "Google Drive Destination URL",
                            name: "folderid",
                            type: "string",
                            required: false,
                        });
                        form.fields.push({
                            description: "Fetch folders",
                            name: "fetchpls",
                            type: "select",
                            interactive: true,
                            label: "Select Fetch to fetch a list of folders in this drive",
                            options: [{ label: "Fetch", name: "fetch" }],
                        });
                    }
                    form.fields.push({
                        label: "Enter a filename",
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
                const errorType = (0, utils_1.getHttpErrorType)(e, this.name);
                let error = (0, action_response_1.errorWith)(errorType, `${LOG_PREFIX} ${e.message}`);
                const errorObjectKeys = [];
                for (const [key, _] of Object.entries(e)) {
                    errorObjectKeys.push(key);
                }
                if (e.code && e.errors && e.errors[0] && e.errors[0].message) {
                    error = {
                        ...error, http_code: e.code, message: `${errorType.description} ${LOG_PREFIX} ${e.errors[0].message}`,
                    };
                }
                winston.error("Can not sign in to Google", { errorKeys: errorObjectKeys, error, webhookId: request.webhookId });
            }
        }
        return this.loginForm(request);
    }
    async oauthUrl(redirectUri, encryptedState) {
        const oauth2Client = this.oauth2Client(redirectUri);
        winston.info(redirectUri);
        // generate a url that asks permissions for Google Drive scope
        const scopes = [
            "https://www.googleapis.com/auth/drive",
            "https://www.googleapis.com/auth/userinfo.email",
        ];
        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes,
            prompt: "consent",
            state: encryptedState,
        });
        return url.toString();
    }
    async oauthFetchInfo(urlParams, redirectUri) {
        const actionCrypto = new Hub.ActionCrypto();
        const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err) => {
            winston.error("Encryption not correctly configured" + err);
            throw err;
        });
        const tokens = await this.getAccessTokenCredentialsFromCode(redirectUri, urlParams.code);
        // Pass back context to Looker
        const payload = JSON.parse(plaintext);
        await https.post({
            url: payload.stateurl,
            body: JSON.stringify({ tokens, redirect: redirectUri }),
        }).catch((_err) => { winston.error(_err.toString()); });
    }
    async oauthCheck(request) {
        if (request.params.state_json) {
            const stateJson = JSON.parse(request.params.state_json);
            if (stateJson.tokens && stateJson.redirect) {
                const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens);
                await drive.files.list({
                    pageSize: 10,
                });
                return true;
            }
        }
        return false;
    }
    oauth2Client(redirectUri) {
        return new googleapis_1.google.auth.OAuth2(process.env.GOOGLE_DRIVE_CLIENT_ID, process.env.GOOGLE_DRIVE_CLIENT_SECRET, redirectUri);
    }
    async sendData(filename, request, drive) {
        let mimeType = this.getMimeType(request);
        if ((mimeType === null || mimeType === void 0 ? void 0 : mimeType.includes("spreadsheetml.sheet")) && mimeType.includes(";base64")) {
            mimeType = mimeType.replace(";base64", "");
        }
        let folder;
        if (request.formParams.folderid) {
            if (request.formParams.folderid.includes("my-drive")) {
                folder = "root";
            }
            else {
                const match = request.formParams.folderid.match(FOLDERID_REGEX);
                if (match && match.groups) {
                    folder = match.groups.folderId;
                }
                else {
                    folder = "root";
                }
            }
        }
        else {
            folder = request.formParams.folder;
        }
        const fileMetadata = {
            name: filename,
            mimeType,
            parents: folder ? [folder] : undefined,
        };
        return request.stream(async (readable) => {
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
        });
    }
    async getDrives(drive, accumulatedFolders, response) {
        const driveList = accumulatedFolders.concat(response.data.drives);
        if (response.data.nextPageToken) {
            const pageOptions = {
                pageSize: 50,
                pageToken: response.data.nextPageToken,
            };
            return this.getDrives(drive, driveList, await drive.drives.list(pageOptions));
        }
        return driveList;
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
    async getAccessTokenCredentialsFromCode(redirect, code) {
        const client = this.oauth2Client(redirect);
        const { tokens } = await client.getToken(code);
        return tokens;
    }
    async driveClientFromRequest(redirect, tokens) {
        const client = this.oauth2Client(redirect);
        client.setCredentials(tokens);
        return googleapis_1.google.drive({ version: "v3", auth: client });
    }
    async getUserEmail(redirect, tokens) {
        const client = this.oauth2Client(redirect);
        client.setCredentials(tokens);
        const authy = googleapis_1.google.oauth2({ version: "v2", auth: client });
        const response = await authy.tokeninfo();
        const email = response.data.email ? response.data.email : "INVALID";
        return email;
    }
    async validateUserInDomainAllowlist(domainAllowlist, redirect, tokens, requestWebhookId) {
        // validating against optional domain allowlist
        if (domainAllowlist) {
            const domainValidator = new domain_validator_1.DomainValidator(domainAllowlist);
            // check for valid domain allowlist before fetching user email address
            if (domainValidator.hasValidDomains()) {
                const userEmail = await this.getUserEmail(redirect, tokens);
                if (domainValidator.isValidEmailDomain(userEmail)) {
                    winston.info("Domain Verification successful", { webhookId: requestWebhookId });
                }
                else {
                    throw "Domain Verification unsuccessful";
                }
            }
            else {
                winston.info("No Domain Verification performed", { webhookId: requestWebhookId });
            }
        }
    }
    async loginForm(request) {
        const form = new Hub.ActionForm();
        form.fields = [];
        const actionCrypto = new Hub.ActionCrypto();
        const jsonString = JSON.stringify({ stateurl: request.params.state_url });
        const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err) => {
            winston.error("Encryption not correctly configured");
            throw err;
        });
        form.state = new Hub.ActionState();
        form.fields.push({
            name: "login",
            type: "oauth_link_google",
            label: "Log in",
            description: "In order to send to Google Drive, you will need to log in" +
                ` once to your Google account. WebhookID if oauth fails: ${request.webhookId}`,
            oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`,
        });
        winston.debug(`Login form, OAuthURL${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`);
        return form;
    }
}
exports.GoogleDriveAction = GoogleDriveAction;
if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
    Hub.addAction(new GoogleDriveAction());
}
