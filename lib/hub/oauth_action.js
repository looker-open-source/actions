"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOauthAction = exports.OAuthAction = void 0;
const action_1 = require("./action");
class OAuthAction extends action_1.Action {
    asJson(router, request) {
        const json = super.asJson(router, request);
        json.uses_oauth = true;
        return json;
    }
}
exports.OAuthAction = OAuthAction;
function isOauthAction(action) {
    return action instanceof OAuthAction;
}
exports.isOauthAction = isOauthAction;
