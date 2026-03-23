"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DropboxAction = void 0;
const dropbox_1 = require("dropbox");
const querystring = require("querystring");
const https = require("request-promise-native");
const url_1 = require("url");
const winston = require("winston");
const Hub = require("../../hub");
class DropboxAction extends Hub.OAuthAction {
    constructor() {
        super(...arguments);
        this.name = "dropbox";
        this.label = "Dropbox";
        this.iconName = "dropbox/dropbox.png";
        this.description = "Send data directly to a Dropbox folder.";
        this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard];
        this.usesStreaming = false;
        this.minimumSupportedLookerVersion = "6.8.0";
        this.requiredFields = [];
        this.params = [];
    }
    // The execute function handles the final delivery of the file to Dropbox.
    // It attempts to extract tokens from request.params.state_json (handling both encrypted and legacy shapes),
    // and if a code/redirect pair is found, it will exchange it for an access token.
    async execute(request) {
        const filename = this.dropboxFilename(request);
        const directory = request.formParams.directory;
        const ext = request.attachment.fileExtension;
        let accessToken = "";
        if (request.params.state_json) {
            const stateJson = await this.oauthExtractTokensFromStateJson(request.params.state_json, request.webhookId);
            if (stateJson && stateJson.code && stateJson.redirect) {
                accessToken = await this.getAccessTokenFromCode(stateJson);
            }
        }
        const drop = await this.dropboxClientFromRequest(request, accessToken);
        const resp = new Hub.ActionResponse();
        resp.success = true;
        if (request.attachment && request.attachment.dataBuffer) {
            const fileBuf = request.attachment.dataBuffer;
            const path = (directory === "__root") ? `/${filename}.${ext}` : `/${directory}/${filename}.${ext}`;
            await drop.filesUpload({ path: `${path}`, contents: fileBuf }).catch((err) => {
                winston.error(`Upload unsuccessful: ${JSON.stringify(err)}`);
                resp.success = false;
                resp.state = new Hub.ActionState();
                resp.state.data = "reset";
            });
        }
        else {
            resp.success = false;
            resp.message = "No data sent from Looker to be sent to Dropbox.";
        }
        return resp;
    }
    // The form function generates the configuration form for the action.
    // Like execute, it inspects state_json for tokens or code/redirect to determine if it should initialize the client or
    // present an OAuth link. If the user is unauthenticated, it generates a login link with the state encrypted using
    // Action Hub's internal crypto.
    async form(request) {
        const form = new Hub.ActionForm();
        form.fields = [];
        let accessToken = "";
        if (request.params.state_json) {
            try {
                const stateJson = await this.oauthExtractTokensFromStateJson(request.params.state_json, request.webhookId);
                if (stateJson && stateJson.code && stateJson.redirect) {
                    accessToken = await this.getAccessTokenFromCode(stateJson);
                }
            }
            catch (e) {
                winston.warn("Could not get access token from code", e);
            }
        }
        const drop = await this.dropboxClientFromRequest(request, accessToken);
        try {
            const response = await drop.filesListFolder({ path: "" });
            const folderList = response.entries.filter((entries) => (entries[".tag"] === "folder"))
                .map((entries) => ({ name: entries.name, label: entries.name }));
            folderList.unshift({ name: "__root", label: "Home" });
            form.fields = [{
                    description: "Dropbox folder where your file will be saved",
                    label: "Select folder to save file",
                    name: "directory",
                    options: folderList,
                    required: true,
                    type: "select",
                    default: "__root",
                }, {
                    label: "Enter a name",
                    name: "filename",
                    type: "string",
                    required: true,
                }, {
                    label: "Append timestamp",
                    name: "includeTimestamp",
                    description: "Append timestamp to end of file name. Should be set to 'Yes' if the file will be sent repeatedly",
                    required: true,
                    default: "no",
                    type: "select",
                    options: [{
                            name: "yes",
                            label: "Yes",
                        }, {
                            name: "no",
                            label: "No",
                        }],
                }];
            if (accessToken !== "") {
                const newState = JSON.stringify({ access_token: accessToken });
                form.state = new Hub.ActionState();
                form.state.data = newState;
            }
            return form;
        }
        catch (_error) {
            const actionCrypto = new Hub.ActionCrypto();
            const jsonString = JSON.stringify({ stateurl: request.params.state_url });
            const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err) => {
                winston.error("Encryption not correctly configured");
                throw err;
            });
            form.state = new Hub.ActionState();
            form.fields.push({
                name: "login",
                type: "oauth_link",
                label: "Log in",
                description: "In order to send to a Dropbox file or folder now and in the future, you will need to log in" +
                    " once to your Dropbox account.",
                oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth?state=${ciphertextBlob}`,
            });
            return (form);
        }
    }
    async oauthUrl(redirectUri, encryptedState) {
        const url = new url_1.URL("https://www.dropbox.com/oauth2/authorize");
        url.search = querystring.stringify({
            response_type: "code",
            client_id: process.env.DROPBOX_ACTION_APP_KEY,
            redirect_uri: redirectUri,
            force_reapprove: true,
            state: encryptedState,
        });
        return url.toString();
    }
    // oauthFetchInfo is called when the OAuth provider redirects back to the action hub with the code.
    // It decrypts the state (Action Hub crypto) to recover stateurl, and uses the shared encryption framework
    // (oauthMaybeEncryptTokens) to secure the code payload before pushing it back to Looker's state url.
    async oauthFetchInfo(urlParams, redirectUri) {
        const actionCrypto = new Hub.ActionCrypto();
        const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err) => {
            winston.error("Encryption not correctly configured" + err);
            throw err;
        });
        const payload = JSON.parse(plaintext);
        const encrypted = await this.oauthMaybeEncryptTokens({ code: urlParams.code, redirect: redirectUri }, undefined);
        await https.post({
            url: payload.stateurl,
            body: encrypted,
        }).catch((_err) => { winston.error(_err.toString()); });
    }
    // oauthCheck verifies if the Action Hub has a valid state for rendering or running.
    // If listing files from root succeeds, it returns true, otherwise false (triggering forms to present login fields).
    async oauthCheck(request) {
        const drop = await this.dropboxClientFromRequest(request, "");
        try {
            await drop.filesListFolder({ path: "" });
            return true;
        }
        catch (err) {
            winston.error(err.error.toString());
            return false;
        }
    }
    dropboxFilename(request) {
        if (request.formParams.filename && request.formParams.includeTimestamp === "yes") {
            return request.formParams.filename + Date.now();
        }
        else {
            return request.formParams.filename;
        }
    }
    async getAccessTokenFromCode(stateJson) {
        const url = new url_1.URL("https://api.dropboxapi.com/oauth2/token");
        if (stateJson.code && stateJson.redirect) {
            url.search = querystring.stringify({
                grant_type: "authorization_code",
                code: stateJson.code,
                client_id: process.env.DROPBOX_ACTION_APP_KEY,
                client_secret: process.env.DROPBOX_ACTION_APP_SECRET,
                redirect_uri: stateJson.redirect,
            });
        }
        else {
            throw "state_json does not contain correct members";
        }
        const response = await https.post(url.toString(), { json: true });
        return response.access_token;
    }
    // dropboxClientFromRequest initializes a Dropbox client instance.
    // If token is defined, it uses it directly. Otherwise, it attempts to parse state_json to find an access_token.
    async dropboxClientFromRequest(request, token) {
        if (request.params.state_json && token === "") {
            try {
                const json = await this.oauthExtractTokensFromStateJson(request.params.state_json, request.webhookId);
                if (json) {
                    if (json.access_token) {
                        token = json.access_token;
                    }
                    else if (json.tokens && json.tokens.access_token) {
                        token = json.tokens.access_token;
                    }
                }
            }
            catch (er) {
                winston.error("Could not parse state_json for Dropbox client", er);
            }
        }
        return new dropbox_1.Dropbox({ accessToken: token });
    }
}
exports.DropboxAction = DropboxAction;
if (process.env.DROPBOX_ACTION_APP_KEY && process.env.DROPBOX_ACTION_APP_SECRET) {
    Hub.addAction(new DropboxAction());
}
