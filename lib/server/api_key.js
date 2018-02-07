"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
    return crypto.timingSafeEqual(new Buffer(providedDigest), new Buffer(digest(nonce)));
}
exports.validate = validate;
