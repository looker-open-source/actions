"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptedPayload = void 0;
const _1 = require(".");
const winston = require("winston");
class EncryptedPayload {
    static get crypto() {
        return new _1.ActionCrypto();
    }
    static get currentCipherId() {
        return this.crypto.cipherId();
    }
    static async encrypt(tokenPayload, webhookId) {
        const jsonPayload = JSON.stringify(tokenPayload.asJson());
        const encrypted = await this.crypto.encrypt(jsonPayload).catch((err) => {
            winston.error("Encryption not correctly configured", { webhookId });
            throw err;
        });
        return new EncryptedPayload(this.currentCipherId, encrypted);
    }
    constructor(cid, payload) {
        this.cid = cid;
        this.payload = payload;
    }
    async decrypt(webhookId) {
        const jsonPayload = await EncryptedPayload.crypto.decrypt(this.payload).catch((err) => {
            winston.error("Failed to decrypt state_json", { webhookId });
            throw err;
        });
        const tokenPayload = JSON.parse(jsonPayload);
        return tokenPayload;
    }
    asJson() {
        return {
            cid: this.cid,
            payload: this.payload,
        };
    }
}
exports.EncryptedPayload = EncryptedPayload;
