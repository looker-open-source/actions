"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WrappedResponse = void 0;
const Hub = require("../../../hub");
const missing_auth_error_1 = require("./missing_auth_error");
class WrappedResponse {
    constructor(klass) {
        this.errorPrefix = "";
        this._hubResp = new klass();
    }
    set form(form) {
        this._hubResp = form;
    }
    returnError(err) {
        if (err instanceof missing_auth_error_1.MissingAuthError) {
            this.resetState();
        }
        this.setError(err);
        return this._hubResp;
    }
    returnSuccess(userState) {
        if (userState) {
            this.setUserState(userState);
        }
        return this._hubResp;
    }
    setError(err) {
        if (this._hubResp instanceof Hub.ActionResponse) {
            this._hubResp.success = false;
            this._hubResp.message = this.errorPrefix + err.toString();
        }
        else if (this._hubResp instanceof Hub.ActionForm) {
            err.message = this.errorPrefix + err.message;
            this._hubResp.error = err;
        }
    }
    resetState() {
        this._hubResp.state = new Hub.ActionState();
        this._hubResp.state.data = "reset";
    }
    setUserState(userState) {
        this._hubResp.state = new Hub.ActionState();
        this._hubResp.state.data = JSON.stringify(userState);
    }
}
exports.WrappedResponse = WrappedResponse;
