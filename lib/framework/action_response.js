"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ActionResponse {
    constructor(fields) {
        this.refreshQuery = false;
        this.success = true;
        this.validationErrors = [];
        if (fields) {
            Object.assign(this, fields);
        }
    }
    asJson() {
        const errs = {};
        for (const error of (this.validationErrors || [])) {
            errs[error.field] = error.message;
        }
        return {
            message: this.message,
            refresh_query: this.refreshQuery,
            success: this.success,
            validation_errors: errs,
        };
    }
}
exports.ActionResponse = ActionResponse;
