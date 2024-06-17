"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionResponse = exports.errorWith = void 0;
function errorWith(errorInfo, message) {
    const error = {
        http_code: errorInfo.code,
        status_code: errorInfo.status,
        message: `${errorInfo.description} ${message}`,
        location: "ActionContainer",
        documentation_url: "TODO",
    };
    return error;
}
exports.errorWith = errorWith;
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
                error: this.error,
                webhookId: this.webhookId,
            },
        };
    }
}
exports.ActionResponse = ActionResponse;
