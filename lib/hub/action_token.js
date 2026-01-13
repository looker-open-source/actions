"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionToken = void 0;
class ActionToken {
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
exports.ActionToken = ActionToken;
