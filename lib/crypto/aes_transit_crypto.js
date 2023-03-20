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
exports.AESTransitCrypto = void 0;
const b64 = require("base64-url");
const crypto = require("crypto");
class AESTransitCrypto {
    constructor() {
        this.ALGORITHM = "aes-256-ctr";
        this.VERSION = 1;
    }
    encrypt(plaintext) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.CIPHER_MASTER === undefined) {
                throw "CIPHER_MASTER environment variable not set";
            }
            const masterbuffer = Buffer.from(process.env.CIPHER_MASTER, "hex");
            const dataKey = crypto.randomBytes(32);
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.ALGORITHM, dataKey, iv);
            let cipherText = cipher.update(plaintext, "utf8", "base64");
            cipherText += cipher.final("base64");
            cipherText = b64.escape(cipherText);
            const masterCipher = crypto.createCipheriv(this.ALGORITHM, masterbuffer, iv);
            let encDataKey = masterCipher.update(dataKey.toString("binary"), "binary", "base64");
            encDataKey += masterCipher.final("base64");
            encDataKey = b64.escape(encDataKey);
            let keysize = ("000" + encDataKey.length);
            keysize = keysize.substring(keysize.length - 3);
            const encdodediv = b64.escape(iv.toString("base64"));
            let ivSize = ("000" + encdodediv.length);
            ivSize = ivSize.substring(ivSize.length - 3);
            /*
            * Url Safe Encryption Payload
            * [ 1       , 3     , 3     , ivsize    , keysize                       , any size                 ]
            * [ Version, keysize, ivsize, base64(iv), base64(enc(dataKey,masterKey)), base64(enc(data,dataKey))]
            * */
            return this.VERSION + keysize + ivSize + encdodediv + encDataKey + cipherText;
        });
    }
    decrypt(ciphertext) {
        return __awaiter(this, void 0, void 0, function* () {
            if (process.env.CIPHER_MASTER === undefined) {
                throw "CIPHER_MASTER environment variable not set";
            }
            const masterBuffer = Buffer.from(process.env.CIPHER_MASTER, "hex");
            const keySize = Number(ciphertext.substring(1, 4));
            const ivSize = Number(ciphertext.substring(4, 7));
            const iv = Buffer.from(b64.unescape(ciphertext.substring(7, 7 + ivSize)), "base64");
            const offset = keySize + ivSize + 7;
            const encDataKey = b64.unescape(ciphertext.substring(7 + ivSize, offset));
            const masterCipher = crypto.createDecipheriv(this.ALGORITHM, masterBuffer, iv);
            // Decrypt dataKey and reassign to a Buffer to decrypt the data
            let dataKey = masterCipher.update(encDataKey, "base64", "binary");
            dataKey += masterCipher.final("binary");
            const byteKey = Buffer.from(dataKey, "binary");
            const cipher = crypto.createDecipheriv(this.ALGORITHM, byteKey, iv);
            let cipherText = cipher.update(b64.unescape(ciphertext.substring(offset)), "base64", "utf8");
            cipherText += cipher.final("utf8");
            return cipherText;
        });
    }
}
exports.AESTransitCrypto = AESTransitCrypto;
