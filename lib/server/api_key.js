"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = exports.fromNonce = void 0;
const crypto = require("crypto");
function digest(nonce) {
    return crypto.createHmac("sha512", process.env.ACTION_HUB_SECRET.toString()).update(nonce).digest("hex");
}
function fromNonce(nonce) {
    return `${nonce}/${digest(nonce)}`;
}
exports.fromNonce = fromNonce;
function validate(key) {
    const [nonce, providedDigest] = key.split("/");
    if (!nonce || !providedDigest) {
        return false;
    }
    return crypto.timingSafeEqual(Buffer.from(providedDigest), Buffer.from(digest(nonce)));
}
exports.validate = validate;
