"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthAction = void 0;
exports.isOauthAction = isOauthAction;
const winston = require("winston");
const _1 = require(".");
const action_1 = require("./action");
class OAuthAction extends action_1.Action {
    asJson(router, request) {
        const json = super.asJson(router, request);
        json.uses_oauth = true;
        return json;
    }
    async oauthExtractTokensFromStateJson(stateJson, requestWebhookId) {
        let state;
        try {
            state = JSON.parse(stateJson);
        }
        catch (e) {
            winston.error(`Failed to parse state_json`, { webhookId: requestWebhookId, action: this.name });
            return null;
        }
        if (state.cid && state.payload) {
            winston.info("Extracting encrypted state_json", { webhookId: requestWebhookId, action: this.name });
            const encryptedPayload = new _1.EncryptedPayload(state.cid, state.payload);
            try {
                const tokenPayload = await this.oauthDecryptTokens(encryptedPayload, requestWebhookId);
                return tokenPayload;
            }
            catch (e) {
                winston.error(`Failed to decrypt or parse encrypted payload: ${e.message}`, { webhookId: requestWebhookId, action: this.name });
                return null;
            }
        }
        else {
            winston.info("Extracting unencrypted state_json", { webhookId: requestWebhookId, action: this.name });
            return state;
        }
    }
    async oauthMaybeEncryptTokens(tokenPayload, requestWebhookId) {
        // Generate the per-action environment variable name
        // e.g. "salesforce_campaigns" -> "ENCRYPT_PAYLOAD_SALESFORCE_CAMPAIGNS"
        const envVarName = `ENCRYPT_PAYLOAD_${this.name.toUpperCase()}`;
        const perActionEncryptionValue = process.env[envVarName];
        // Check per-action variable. Default to false if not set.
        // We explicitly do NOT fallback to ENCRYPT_PAYLOAD as that is reserved for Google Drive.
        const shouldEncrypt = perActionEncryptionValue === "true";
        if (shouldEncrypt) {
            const encrypted = await new _1.ActionCrypto().encrypt(JSON.stringify(tokenPayload)).catch((err) => {
                winston.error("Encryption not correctly configured", { webhookId: requestWebhookId, action: this.name });
                throw err;
            });
            const payload = new _1.EncryptedPayload(_1.EncryptedPayload.currentCipherId, encrypted);
            return payload;
        }
        else {
            return JSON.stringify(tokenPayload);
        }
    }
    async oauthDecryptTokens(encryptedPayload, requestWebhookId) {
        const actionCrypto = new _1.ActionCrypto();
        const jsonPayload = await actionCrypto.decrypt(encryptedPayload.payload).catch((err) => {
            winston.error("Failed to decrypt state_json", { webhookId: requestWebhookId, action: this.name });
            throw err;
        });
        return JSON.parse(jsonPayload);
    }
}
exports.OAuthAction = OAuthAction;
function isOauthAction(action) {
    return action instanceof OAuthAction;
}
