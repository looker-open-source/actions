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
    /**
     * Extracts token state from a JSON string.
     * - If parsing fails, returns null.
     * - If encryption markers are present, attempts to decrypt.
     * - Otherwise, returns the unencrypted JSON object.
     */
    async oauthExtractTokensFromStateJson(stateJson, requestWebhookId) {
        // Looker sends the literal string "reset" to clear action state.
        // We check for it explicitly here to prevent JSON parsing failures
        // and avoid spamming the logs with SyntaxErrors for a valid protocol state.
        if (stateJson === "reset") {
            winston.info("State is reset, ignoring tokens", { webhookId: requestWebhookId, action: this.name });
            return null;
        }
        let state;
        try {
            state = JSON.parse(stateJson);
        }
        catch (e) {
            winston.error(`Failed to parse state_json`, { webhookId: requestWebhookId, action: this.name });
            return null;
        }
        if (!state.cid || !state.payload) {
            winston.info("Extracting unencrypted state_json", { webhookId: requestWebhookId, action: this.name });
            return state;
        }
        winston.info("Extracting encrypted state_json", { webhookId: requestWebhookId, action: this.name });
        const encryptedPayload = new encrypted_payload_1.EncryptedPayload(state.cid, state.payload);
        try {
            return await this.oauthDecryptTokens(encryptedPayload, requestWebhookId);
        }
        catch (e) {
            winston.error(`Failed to decrypt or parse encrypted payload: ${e.message}`, { webhookId: requestWebhookId, action: this.name });
            return null;
        }
    }
    /**
     * Conditionally encrypts token payloads based on the per-action environment config.
     * - If `ENCRYPT_PAYLOAD_<ACTION_NAME>` is "true", returns an EncryptedPayload.
     * - Otherwise, returns a standard stringified JSON payload.
     */
    async oauthMaybeEncryptTokens(tokenPayload, requestWebhookId) {
        const envVarName = `ENCRYPT_PAYLOAD_${this.name.toUpperCase()}`;
        const perActionEncryptionValue = process.env[envVarName];
        if (perActionEncryptionValue !== "true") {
            return JSON.stringify(tokenPayload);
        }
        const encrypted = await OAuthAction.actionCrypto.encrypt(JSON.stringify(tokenPayload)).catch((err) => {
            winston.error("Encryption not correctly configured", { webhookId: requestWebhookId, action: this.name });
            throw err;
        });
        return new encrypted_payload_1.EncryptedPayload(encrypted_payload_1.EncryptedPayload.currentCipherId, encrypted);
    }
    async oauthDecryptTokens(encryptedPayload, requestWebhookId) {
        // This method decrypts the payload and validates the JSON shape.
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
