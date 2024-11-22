"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubspotActionError = void 0;
class HubspotActionError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.HubspotActionError = HubspotActionError;
