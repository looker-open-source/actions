"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalCryptoTesting = void 0;
const b64 = require("base64-url");
const crypto = require("crypto");
// This class is meant for local development and will never go into production
class LocalCryptoTesting {
    constructor() {
        this.ALGORITHM = "aes-256-cbc";
        this.INSECURE_IV = Buffer.alloc(16);
    }
    async encrypt(plaintext) {
        if (process.env.CIPHER_PASSWORD === undefined) {
            throw "CIPHER_PASSWORD environment variable not set";
        }
        const passHash = crypto.createHash("md5").update(process.env.CIPHER_PASSWORD).digest("hex").toUpperCase();
        const cipher = crypto.createCipheriv(this.ALGORITHM, passHash, this.INSECURE_IV);
        let cipherText = cipher.update(plaintext, "utf8", "base64");
        cipherText += cipher.final("base64");
        return b64.escape(cipherText);
    }
    async decrypt(ciphertext) {
        if (process.env.CIPHER_PASSWORD === undefined) {
            throw "CIPHER_PASSWORD environment variable not set";
        }
        const passHash = crypto.createHash("md5").update(process.env.CIPHER_PASSWORD).digest("hex").toUpperCase();
        const cipher = crypto.createDecipheriv(this.ALGORITHM, passHash, this.INSECURE_IV);
        let cipherText = cipher.update(b64.unescape(ciphertext), "base64", "utf8");
        cipherText += cipher.final("utf8");
        return cipherText;
    }
}
exports.LocalCryptoTesting = LocalCryptoTesting;
