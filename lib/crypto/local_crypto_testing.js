"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    encrypt(plaintext) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.CIPHER_PASSWORD === undefined) {
                throw "CIPHER_PASSWORD environment variable not set";
            }
            const passHash = crypto.createHash("md5").update(process.env.CIPHER_PASSWORD).digest("hex").toUpperCase();
            const cipher = crypto.createCipheriv(this.ALGORITHM, passHash, this.INSECURE_IV);
            let cipherText = cipher.update(plaintext, "utf8", "base64");
            cipherText += cipher.final("base64");
            return b64.escape(cipherText);
        });
    }
    decrypt(ciphertext) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.CIPHER_PASSWORD === undefined) {
                throw "CIPHER_PASSWORD environment variable not set";
            }
            const passHash = crypto.createHash("md5").update(process.env.CIPHER_PASSWORD).digest("hex").toUpperCase();
            const cipher = crypto.createDecipheriv(this.ALGORITHM, passHash, this.INSECURE_IV);
            let cipherText = cipher.update(b64.unescape(ciphertext), "base64", "utf8");
            cipherText += cipher.final("utf8");
            return cipherText;
        });
    }
}
exports.LocalCryptoTesting = LocalCryptoTesting;
