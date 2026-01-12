"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenPayload = void 0;
class TokenPayload {
    constructor(tokens, redirect) {
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
exports.TokenPayload = TokenPayload;
