"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookCustomAudiencesAction = void 0;
const gaxios = require("gaxios");
const Hub = require("../../hub");
const querystring = require("querystring");
const url_1 = require("url");
const winston = require("winston");
const api_1 = require("./lib/api");
const executor_1 = require("./lib/executor");
const form_builder_1 = require("./lib/form_builder");
const util_1 = require("./lib/util");
class FacebookCustomAudiencesAction extends Hub.OAuthAction {
    constructor(oauthClientId, oauthClientSecret) {
        super();
        this.name = "facebook_custom_audiences";
        this.label = "Facebook Custom Audiences";
        this.iconName = "facebook/facebook_ads_icon.png";
        this.description = "Upload data to Facebook Ads Custom Audiences from Customer List";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonDetailLiteStream];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.supportedDownloadSettings = [Hub.ActionDownloadSettings.Url];
        this.usesStreaming = true;
        this.requiredFields = [];
        this.params = [];
        this.executeInOwnProcess = true;
        this.oauthScope = "ads_management,business_management";
        this.oauthClientId = oauthClientId;
        this.oauthClientSecret = oauthClientSecret;
    }
    execute(hubRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            let response = new Hub.ActionResponse();
            const accessToken = yield this.getAccessTokenFromRequest(hubRequest);
            if (!accessToken) {
                response.state = new Hub.ActionState();
                response.state.data = "reset";
                response.success = false;
                response.message = "Failed to execute Facebook Custom Audiences due to missing authentication credentials. No data sent to Facebook. Please try again or contact support";
                return response;
            }
            const executor = new executor_1.default(hubRequest, accessToken);
            response = yield executor.run();
            return response;
        });
    }
    form(hubRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            const formBuilder = new form_builder_1.default();
            try {
                const isAlreadyAuthenticated = yield this.oauthCheck(hubRequest);
                const accessToken = yield this.getAccessTokenFromRequest(hubRequest);
                if (isAlreadyAuthenticated && accessToken) {
                    const facebookApi = new api_1.default(accessToken);
                    const actionForm = yield formBuilder.generateActionForm(hubRequest, facebookApi);
                    return actionForm;
                }
            }
            catch (err) {
                util_1.sanitizeError(err);
                winston.error(err);
            }
            // Return the login form to start over if anything goes wrong during authentication or form construction
            // If a user is unauthenticated they are expected to hit an error above
            const loginForm = formBuilder.generateLoginForm(hubRequest);
            return loginForm;
        });
    }
    oauthUrl(redirectUri, encryptedState) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = new url_1.URL(`https://www.facebook.com/${api_1.API_VERSION}/dialog/oauth`);
            url.search = querystring.stringify({
                client_id: this.oauthClientId,
                redirect_uri: redirectUri,
                state: encryptedState,
                scope: this.oauthScope,
            });
            return url.toString();
        });
    }
    oauthFetchInfo(urlParams, redirectUri) {
        return __awaiter(this, void 0, void 0, function* () {
            let plaintext;
            try {
                const actionCrypto = new Hub.ActionCrypto();
                plaintext = yield actionCrypto.decrypt(urlParams.state);
            }
            catch (err) {
                winston.error("Encryption not correctly configured: " + err.toString());
                throw err;
            }
            const payload = JSON.parse(plaintext);
            // adding our app secret to the mix gives us a long-lived token (which lives ~60 days) instead of short-lived token
            const longLivedTokenRequestUri = `https://graph.facebook.com/${api_1.API_VERSION}` +
                `/oauth/access_token?client_id=${this.oauthClientId}&redirect_uri=${redirectUri}` +
                `&client_secret=${this.oauthClientSecret}&code=${urlParams.code}`;
            const longLivedTokenResponse = yield gaxios.request({ method: "GET", url: longLivedTokenRequestUri });
            const longLivedToken = longLivedTokenResponse.data.access_token;
            const tokens = { longLivedToken };
            const userState = { tokens, redirect: redirectUri };
            // So now we use that state url to persist the oauth tokens
            try {
                yield gaxios.request({
                    method: "POST",
                    url: payload.stateUrl,
                    data: userState,
                });
            }
            catch (err) {
                util_1.sanitizeError(err);
                // We have seen weird behavior where Looker correctly updates the state, but returns a nonsense status code
                if (err instanceof gaxios.GaxiosError && err.response !== undefined && err.response.status < 100) {
                    winston.debug("Ignoring state update response with response code <100");
                }
                else {
                    winston.error("Error sending user state to Looker:" + (err && err.toString()));
                    throw err;
                }
            }
        });
    }
    /*
      Facebook expired responses look like (in v11):
      {
        "error": {
          "message": "Error validating access token: Session has expired on Thursday,
            29-Jul-21 10:00:00 PDT. The current time is Friday, 30-Jul-21 06:41:07 PDT.",
          "type": "OAuthException",
          "code": 190,
          "error_subcode": 463,
          "fbtrace_id": "A_muLgNXB2rhzyBV_3YbJeo"
        }
      }
    */
    oauthCheck(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const accessToken = yield this.getAccessTokenFromRequest(request);
                if (!accessToken) {
                    winston.error("Failed oauthCheck because access token was missing or malformed");
                    return false;
                }
                const userDataRequestUri = `https://graph.facebook.com/${api_1.API_VERSION}/me?access_token=${accessToken}`;
                const userDataResponse = yield gaxios.request({ method: "GET", url: userDataRequestUri });
                if (userDataResponse.data.error && userDataResponse.data.error.message) {
                    winston.debug("Failed oauthCheck because access token was expired or due to an error: " +
                        userDataResponse.data.error.message);
                    return false;
                }
                return true;
            }
            catch (err) {
                util_1.sanitizeError(err);
                winston.debug("Failed oauthCheck because access token was expired or due to an error: " + err);
                return false;
            }
        });
    }
    getAccessTokenFromRequest(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const params = request.params;
                return JSON.parse(params.state_json).tokens.longLivedToken;
            }
            catch (err) {
                winston.error("Failed to parse state for access token.");
                return null;
            }
        });
    }
}
exports.FacebookCustomAudiencesAction = FacebookCustomAudiencesAction;
/******** Register with Hub if prereqs are satisfied ********/
if (process.env.FACEBOOK_CLIENT_ID
    && process.env.FACEBOOK_CLIENT_SECRET) {
    const fcma = new FacebookCustomAudiencesAction(process.env.FACEBOOK_CLIENT_ID, process.env.FACEBOOK_CLIENT_SECRET);
    Hub.addAction(fcma);
}
else {
    winston.warn(`[Facebook Custom Audiences] Action not registered because required environment variables are missing.`);
}
