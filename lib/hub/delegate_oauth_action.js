"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDelegateOauthAction = exports.DelegateOAuthAction = void 0;
const action_1 = require("./action");
class DelegateOAuthAction extends action_1.Action {
    asJson(router, request) {
        const json = super.asJson(router, request);
        json.uses_oauth = true;
        json.delegate_oauth = true;
        return json;
    }
}
exports.DelegateOAuthAction = DelegateOAuthAction;
function isDelegateOauthAction(action) {
    return action instanceof DelegateOAuthAction;
}
exports.isDelegateOauthAction = isDelegateOauthAction;
