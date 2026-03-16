"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthAction = void 0;
exports.isOauthAction = isOauthAction;
const winston = require("winston");
const aes_transit_crypto_1 = require("../crypto/aes_transit_crypto");
const action_1 = require("./action");
const encrypted_payload_1 = require("./encrypted_payload");
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
            const encryptedPayload = new encrypted_payload_1.EncryptedPayload(state.cid, state.payload);
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
            const encrypted = await OAuthAction.actionCrypto.encrypt(JSON.stringify(tokenPayload)).catch((err) => {
                winston.error("Encryption not correctly configured", { webhookId: requestWebhookId, action: this.name });
                throw err;
            });
            const payload = new encrypted_payload_1.EncryptedPayload(encrypted_payload_1.EncryptedPayload.currentCipherId, encrypted);
            return payload;
        }
        else {
            return JSON.stringify(tokenPayload);
        }
    }
    async oauthDecryptTokens(encryptedPayload, requestWebhookId) {
        const jsonPayload = await OAuthAction.actionCrypto.decrypt(encryptedPayload.payload).catch((err) => {
            winston.error("Failed to decrypt state_json", { webhookId: requestWebhookId, action: this.name });
            throw err;
        });
        let parsed;
        try {
            parsed = JSON.parse(jsonPayload);
        }
        catch (_a) {
            throw new Error("Decrypted payload is not valid JSON");
        }
        if (typeof parsed !== "object" || parsed === null) {
            throw new Error("Decrypted payload must be a JSON object");
        }
        return parsed;
    }
}
exports.OAuthAction = OAuthAction;
OAuthAction.actionCrypto = new aes_transit_crypto_1.AESTransitCrypto();
function isOauthAction(action) {
    return action instanceof OAuthAction;
}
