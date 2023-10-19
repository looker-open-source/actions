"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RudderActionError = void 0;
class RudderActionError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.RudderActionError = RudderActionError;
