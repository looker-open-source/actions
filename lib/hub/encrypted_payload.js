"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptedPayload = void 0;
const _1 = require(".");
const winston = require("winston");
class EncryptedPayload {
    static get crypto() {
        if (this._crypto === undefined) {
            this._crypto = new _1.ActionCrypto();
        }
        return this._crypto;
    }
    static get currentCipherId() {
        if (this._currentCipherId === undefined) {
            this._currentCipherId = this.crypto.cipherId();
        }
        return this._currentCipherId;
    }
    constructor(cid, payload) {
        this.cid = cid;
        this.payload = payload;
    }
    static async encrypt(tokenPayload, webhookId) {
        const jsonPayload = JSON.stringify(tokenPayload.asJson());
        const encrypted = await this.crypto.encrypt(jsonPayload).catch((err) => {
            winston.error("Encryption not correctly configured", { webhookId: webhookId });
            throw err;
        });
        return new EncryptedPayload(this.currentCipherId, encrypted);
    }
    async decrypt(webhookId) {
        const jsonPayload = await EncryptedPayload.crypto.decrypt(this.payload).catch((err) => {
            winston.error("Failed to decrypt state_json", { webhookId: webhookId });
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
EncryptedPayload._crypto = undefined;
EncryptedPayload._currentCipherId = undefined;
