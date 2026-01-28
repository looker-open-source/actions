"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptedPayload = void 0;
class EncryptedPayload {
    constructor(cid, payload) {
        this.cid = cid;
        this.payload = payload;
    }
    asJson() {
        return {
            cid: this.cid,
            payload: this.payload,
        };
    }
}
exports.EncryptedPayload = EncryptedPayload;
