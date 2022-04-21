"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingRequiredParamsError = void 0;
class MissingRequiredParamsError extends Error {
    constructor(message) {
        super(message);
        // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
        this.name = MissingRequiredParamsError.name; // stack traces display correctly now
    }
}
exports.MissingRequiredParamsError = MissingRequiredParamsError;
