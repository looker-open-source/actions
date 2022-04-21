"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionResponse = void 0;
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
        if (this.validationErrors.length > 0) {
            for (const error of this.validationErrors) {
                errs[error.field] = error.message;
            }
        }
        return {
            looker: {
                message: this.message,
                refresh_query: this.refreshQuery,
                success: this.success,
                validation_errors: errs,
                state: this.state,
            },
        };
    }
}
exports.ActionResponse = ActionResponse;
