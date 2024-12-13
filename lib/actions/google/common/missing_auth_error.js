"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissingAuthError = void 0;
class MissingAuthError extends Error {
    constructor(message) {
        super(message);
        // see: typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
        Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain
        this.name = MissingAuthError.name; // stack traces display correctly now
    }
}
exports.MissingAuthError = MissingAuthError;
