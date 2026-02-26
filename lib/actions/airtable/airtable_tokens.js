"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AirtableTokens = void 0;
const hub_1 = require("../../hub");
class AirtableTokens extends hub_1.TokenPayload {
    static fromJson(json) {
        if (json.tokens) {
            return new AirtableTokens(json.tokens.refresh_token, json.tokens.access_token, json.redirect);
        }
        return new AirtableTokens(json.refresh_token, json.access_token, json.redirectUri);
    }
    constructor(refreshToken, accessToken, redirectUri) {
        super();
        this.refresh_token = refreshToken;
        this.access_token = accessToken;
        this.redirectUri = redirectUri;
    }
    asJson() {
        return {
            tokens: {
                refresh_token: this.refresh_token,
                access_token: this.access_token,
            },
            redirect: this.redirectUri,
        };
    }
    toJSON() {
        return this.asJson();
    }
}
exports.AirtableTokens = AirtableTokens;
