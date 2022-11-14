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
exports.GoogleAdsCustomerMatch = void 0;
const winston = require("winston");
const Hub = require("../../../hub");
const error_utils_1 = require("../common/error_utils");
const missing_auth_error_1 = require("../common/missing_auth_error");
const oauth_helper_1 = require("../common/oauth_helper");
const wrapped_response_1 = require("../common/wrapped_response");
const ads_request_1 = require("./lib/ads_request");
const LOG_PREFIX = "[G Ads Customer Match]";
class GoogleAdsCustomerMatch extends Hub.OAuthAction {
    /******** Constructor & Helpers ********/
    constructor(oauthClientId, oauthClientSecret, developerToken) {
        super();
        /******** Core action properties ********/
        this.name = "google_ads_customer_match";
        this.label = "Google Ads Customer Match";
        this.iconName = "google/ads/google_ads_icon.svg";
        this.description = "Upload data to Google Ads Customer Match.";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonLabel];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.supportedDownloadSettings = [Hub.ActionDownloadSettings.Url];
        this.usesStreaming = true;
        this.requiredFields = [];
        this.params = [];
        /******** Other fields + OAuth stuff ********/
        this.redirectUri = `${process.env.ACTION_HUB_BASE_URL}/actions/${encodeURIComponent(this.name)}/oauth_redirect`;
        this.oauthScopes = [
            "https://www.googleapis.com/auth/adwords",
        ];
        this.developerToken = developerToken;
        this.oauthClientId = oauthClientId;
        this.oauthClientSecret = oauthClientSecret;
        this.oauthHelper = new oauth_helper_1.GoogleOAuthHelper(this, this.makeLogger("oauth"));
    }
    makeLogger(webhookId = "") {
        return (level, ...rest) => {
            return winston.log(level, LOG_PREFIX, `[webhookID=${webhookId}]`, ...rest);
        };
    }
    makeOAuthClient() {
        return this.oauthHelper.makeOAuthClient(this.redirectUri);
    }
    /******** OAuth Endpoints ********/
    oauthUrl(redirectUri, encryptedState) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.oauthHelper.oauthUrl(redirectUri, encryptedState);
        });
    }
    oauthFetchInfo(urlParams, redirectUri) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.oauthHelper.oauthFetchInfo(urlParams, redirectUri);
        });
    }
    oauthCheck(_request) {
        return __awaiter(this, void 0, void 0, function* () {
            // This part of Hub.OAuthAction is deprecated and unused
            return true;
        });
    }
    /******** Action Endpoints ********/
    execute(hubReq) {
        return __awaiter(this, void 0, void 0, function* () {
            const wrappedResp = new wrapped_response_1.WrappedResponse(Hub.ActionResponse);
            const log = this.makeLogger(hubReq.webhookId);
            try {
                const adsRequest = yield ads_request_1.GoogleAdsActionRequest.fromHub(hubReq, this, log);
                yield adsRequest.execute();
                log("info", "Execution complete");
                return wrappedResp.returnSuccess(adsRequest.userState);
            }
            catch (err) {
                error_utils_1.sanitizeError(err);
                error_utils_1.makeBetterErrorMessage(err, hubReq.webhookId);
                log("error", "Execution error toString:", err.toString());
                log("error", "Execution error JSON:", JSON.stringify(err));
                return wrappedResp.returnError(err);
            }
        });
    }
    form(hubReq) {
        return __awaiter(this, void 0, void 0, function* () {
            const wrappedResp = new wrapped_response_1.WrappedResponse(Hub.ActionForm);
            const log = this.makeLogger(hubReq.webhookId);
            try {
                const adsWorker = yield ads_request_1.GoogleAdsActionRequest.fromHub(hubReq, this, log);
                wrappedResp.form = yield adsWorker.makeForm();
                return wrappedResp.returnSuccess(adsWorker.userState);
                // Use this code if you need to force a state reset and redo oauth login
                // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
                // wrappedResp.resetState()
                // return wrappedResp.returnSuccess()
            }
            catch (err) {
                error_utils_1.sanitizeError(err);
                const loginForm = yield this.oauthHelper.makeLoginForm(hubReq);
                // Token errors that we can detect ahead of time
                if (err instanceof missing_auth_error_1.MissingAuthError) {
                    log("debug", "Caught MissingAuthError; returning login form.");
                    return loginForm;
                }
                log("error", "Form error toString:", err.toString());
                log("error", "Form error JSON:", JSON.stringify(err));
                // AuthorizationError from API client - this occurs when request contains bad loginCid or targetCid
                if (err.code === "403") {
                    wrappedResp.errorPrefix = `Error loading target account with request: ${err.response.request.responseURL}. `
                        + `${err.response.data[0].error.details[0].errors[0].message}`
                        + ` Please retry loading the form again with the correct login account. `;
                    return wrappedResp.returnError(err);
                }
                // Other errors from the API client - typically an auth problem
                if (err.code) {
                    loginForm.fields[0].label =
                        `Received error code ${err.code} from the API, so your credentials have been discarded.`
                            + " Please reauthenticate and try again.";
                    return loginForm;
                }
                // All other errors
                wrappedResp.errorPrefix = "Form generation error: ";
                return wrappedResp.returnError(err);
            }
        });
    }
}
exports.GoogleAdsCustomerMatch = GoogleAdsCustomerMatch;
/******** Register with Hub if prereqs are satisfied ********/
if (process.env.GOOGLE_ADS_CLIENT_ID
    && process.env.GOOGLE_ADS_CLIENT_SECRET
    && process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
    const gacm = new GoogleAdsCustomerMatch(process.env.GOOGLE_ADS_CLIENT_ID, process.env.GOOGLE_ADS_CLIENT_SECRET, process.env.GOOGLE_ADS_DEVELOPER_TOKEN);
    Hub.addAction(gacm);
}
else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`);
}
