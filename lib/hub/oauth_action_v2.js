"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthActionV2 = void 0;
exports.isOauthActionV2 = isOauthActionV2;
const action_1 = require("./action");
class OAuthActionV2 extends action_1.Action {
    asJson(router, request) {
        const json = super.asJson(router, request);
        json.uses_oauth = true;
        json.token_url = router.tokenUrl(this);
        return json;
    }
}
exports.OAuthActionV2 = OAuthActionV2;
function isOauthActionV2(action) {
    return action instanceof OAuthActionV2;
}
