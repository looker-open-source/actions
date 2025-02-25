"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirtableAction = void 0;
const Hub = require("../../hub");
const crypto = require("crypto");
const gaxios = require("gaxios");
const qs = require("qs");
const winston = require("winston");
const hub_1 = require("../../hub");
const airtable = require("airtable");
class AirtableAction extends Hub.OAuthAction {
    constructor() {
        super(...arguments);
        this.name = "airtable";
        this.label = "Airtable";
        this.iconName = "airtable/airtable.png";
        this.description = "Add records to an Airtable table.";
        this.params = [];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.SCOPE = "data.records:write schema.bases:read schema.bases:write";
    }
    async execute(request) {
        if (!(request.attachment && request.attachment.dataJSON)) {
            throw "No attached json.";
        }
        if (!(request.formParams.base && request.formParams.table)) {
            throw "Missing Airtable base or table.";
        }
        const qr = request.attachment.dataJSON;
        if (!qr.fields || !qr.data) {
            throw "Request payload is an invalid format.";
        }
        const fields = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]));
        const fieldMap = {};
        for (const field of fields) {
            fieldMap[field.name] = field.label_short || field.label || field.name;
        }
        const records = qr.data.map((row) => {
            const record = {};
            for (const field of fields) {
                record[fieldMap[field.name]] = row[field.name].value;
            }
            return record;
        });
        const response = new hub_1.ActionResponse({ success: true });
        const state = new hub_1.ActionState();
        try {
            let accessToken;
            if (request.params.state_json) {
                const stateJson = JSON.parse(request.params.state_json);
                accessToken = stateJson.tokens.access_token;
                state.data = JSON.stringify({
                    tokens: {
                        refresh_token: stateJson.tokens.refresh_token,
                        access_token: accessToken,
                    },
                });
            }
            try {
                await this.executeAirtable(request, records, accessToken);
            }
            catch (_a) {
                if (request.params.state_json) {
                    const stateJson = JSON.parse(request.params.state_json);
                    const refreshResponse = await this.refreshTokens(stateJson.tokens.refresh_token);
                    // @ts-ignore
                    if (Object.keys(refreshResponse.data).length !== 0) {
                        accessToken = refreshResponse.data.access_token;
                        state.data = JSON.stringify({
                            tokens: {
                                refresh_token: refreshResponse.data.refresh_token,
                                access_token: accessToken,
                            },
                        });
                    }
                    else {
                        delete state.data;
                    }
                }
                // Try again one more time
                await this.executeAirtable(request, records, accessToken);
            }
        }
        catch (e) {
            response.success = false;
            response.message = e.message;
        }
        response.state = state;
        return new Hub.ActionResponse(response);
    }
    async checkBaseList(token) {
        return gaxios.request({
            method: "GET",
            url: "https://api.airtable.com/v0/meta/bases",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }).catch((_err) => {
            throw "Error listing bases, oauth credentials most likely expired.";
        });
    }
    async form(request) {
        const form = new Hub.ActionForm();
        try {
            let accessToken;
            if (request.params.state_json) {
                const stateJson = JSON.parse(request.params.state_json);
                accessToken = stateJson.tokens.access_token;
            }
            try {
                await this.checkBaseList(accessToken);
                if (form.state === undefined) {
                    form.state = new hub_1.ActionState();
                    form.state.data = request.params.state_json;
                }
            }
            catch (_a) {
                // Assume the failure is due to Oauth failure,
                // refresh token and retry once.
                if (request.params.state_json) {
                    const stateJson = JSON.parse(request.params.state_json);
                    const refreshResponse = await this.refreshTokens(stateJson.tokens.refresh_token);
                    if (Object.keys(refreshResponse.data).length !== 0) {
                        accessToken = refreshResponse.data.access_token;
                        form.state = new hub_1.ActionState();
                        form.state.data = JSON.stringify({ tokens: {
                                refresh_token: refreshResponse.data.refresh_token,
                                access_token: accessToken,
                            } });
                    }
                }
                await this.checkBaseList(accessToken);
            }
            form.fields = [{
                    label: "Airtable Base",
                    name: "base",
                    required: true,
                    type: "string",
                }, {
                    label: "Airtable Table",
                    name: "table",
                    required: true,
                    type: "string",
                }];
        }
        catch (e) {
            // prevents others from impersonating you
            const codeVerifier = crypto.randomBytes(96).toString("base64url"); // 128 characters
            const actionCrypto = new Hub.ActionCrypto();
            const jsonString = JSON.stringify({ stateurl: request.params.state_url, verifier: codeVerifier });
            const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err) => {
                winston.error("Encryption not correctly configured");
                throw err;
            });
            form.fields = [{
                    label: "Login",
                    name: "oauth",
                    type: "oauth_link",
                    oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`,
                }];
        }
        return form;
    }
    async oauthCheck(_request) {
        return false;
    }
    async oauthFetchInfo(urlParams, redirectUri) {
        const actionCrypto = new Hub.ActionCrypto();
        const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err) => {
            winston.error("Encryption not correctly configured" + err);
            throw err;
        });
        const payload = JSON.parse(plaintext);
        const dataString = qs.stringify({
            clientId: process.env.AIRTABLE_CLIENT_ID,
            grant_type: "authorization_code",
            code_verifier: payload.verifier,
            redirect_uri: redirectUri,
            code: urlParams.code,
        });
        const encodedCreds = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`)
            .toString("base64");
        const response = await gaxios.request({
            method: "POST",
            url: "https://www.airtable.com/oauth2/v1/token",
            headers: {
                "Authorization": `Basic ${encodedCreds}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data: dataString,
        });
        // Pass back context to Looker
        if (response.status === 200) {
            const data = response.data;
            await gaxios.request({
                url: payload.stateurl,
                method: "POST",
                body: JSON.stringify({ tokens: {
                        refresh_token: data.refresh_token,
                        access_token: data.access_token,
                    }, redirect: redirectUri }),
            }).catch((_err) => { winston.error(_err.toString()); });
        }
        else {
            winston.warn("Oauth for Airtable unsuccessful");
            throw "OAuth did not work";
        }
    }
    async oauthUrl(redirectUri, encryptedState) {
        const clientId = process.env.AIRTABLE_CLIENT_ID ? process.env.AIRTABLE_CLIENT_ID : "must exist";
        const actionCrypto = new Hub.ActionCrypto();
        const plaintext = await actionCrypto.decrypt(encryptedState).catch((err) => {
            winston.error("Encryption not correctly configured" + err);
            throw err;
        });
        const payload = JSON.parse(plaintext);
        // prevents others from impersonating you
        const codeVerifier = payload.verifier; // 128 characters
        const codeChallengeMethod = "S256";
        const codeChallenge = crypto
            .createHash("sha256")
            .update(codeVerifier) // hash the code verifier with the sha256 algorithm
            .digest("base64") // base64 encode, needs to be transformed to base64url
            .replace(/=/g, "") // remove =
            .replace(/\+/g, "-") // replace + with -
            .replace(/\//g, "_"); // replace / with _ now base64url encoded
        // build the authorization URL
        const authorizationUrl = new URL(`https://www.airtable.com/oauth2/v1/authorize`);
        authorizationUrl.searchParams.set("code_challenge", codeChallenge);
        authorizationUrl.searchParams.set("code_challenge_method", codeChallengeMethod);
        authorizationUrl.searchParams.set("state", encryptedState);
        authorizationUrl.searchParams.set("client_id", clientId);
        authorizationUrl.searchParams.set("redirect_uri", redirectUri);
        authorizationUrl.searchParams.set("response_type", "code");
        // your OAuth integration register with these scopes in the management page
        authorizationUrl.searchParams.set("scope", this.SCOPE);
        return authorizationUrl.toString();
    }
    async airtableClientFromRequest(token) {
        return new airtable({ apiKey: token });
    }
    async refreshTokens(refreshToken) {
        try {
            const dataString = qs.stringify({
                client_id: process.env.AIRTABLE_CLIENT_ID,
                grant_type: "refresh_token",
                refresh_token: refreshToken,
            });
            const encodedCreds = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`)
                .toString("base64");
            return await gaxios.request({
                method: "POST",
                url: "https://www.airtable.com/oauth2/v1/token",
                headers: {
                    "Authorization": `Basic ${encodedCreds}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data: dataString,
            });
        }
        catch (e) {
            let errorMessage = `Error with Airtable Access Token Refresh`;
            if (e instanceof gaxios.GaxiosError) {
                errorMessage = errorMessage + ` returning http code ${e.code}`;
            }
            winston.warn(errorMessage);
            return { data: {} };
        }
    }
    async executeAirtable(request, records, accessToken) {
        const airtableClient = await this.airtableClientFromRequest(accessToken);
        const base = airtableClient.base(request.formParams.base);
        const table = base(request.formParams.table);
        await Promise.all(records.map(async (record) => {
            return new Promise((resolve, reject) => {
                table.create(record, (err, rec) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(rec);
                    }
                });
            });
        }));
    }
}
exports.AirtableAction = AirtableAction;
if (process.env.AIRTABLE_CLIENT_ID && process.env.AIRTABLE_CLIENT_SECRET) {
    Hub.addAction(new AirtableAction());
}
