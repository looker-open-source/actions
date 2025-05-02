"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerIoActionError = void 0;
class CustomerIoActionError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.CustomerIoActionError = CustomerIoActionError;
