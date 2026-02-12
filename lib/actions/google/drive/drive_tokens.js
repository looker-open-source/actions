"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriveTokens = void 0;
const hub_1 = require("../../../hub");
class DriveTokens extends hub_1.TokenPayload {
    static fromJson(json) {
        return new DriveTokens(json.tokens, json.redirect);
    }
    constructor(tokens, redirect) {
        super();
        this.tokens = tokens;
        this.redirect = redirect;
    }
    asJson() {
        return {
            tokens: this.tokens,
            redirect: this.redirect,
        };
    }
}
exports.DriveTokens = DriveTokens;
