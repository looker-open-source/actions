"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SegmentActionError = void 0;
class SegmentActionError extends Error {
    constructor(message) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.SegmentActionError = SegmentActionError;
