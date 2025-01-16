"use strict";
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
    async oauthUrl(redirectUri, encryptedState) {
        return this.oauthHelper.oauthUrl(redirectUri, encryptedState);
    }
    async oauthFetchInfo(urlParams, redirectUri) {
        return this.oauthHelper.oauthFetchInfo(urlParams, redirectUri);
    }
    async oauthCheck(_request) {
        // This part of Hub.OAuthAction is deprecated and unused
        return true;
    }
    /******** Action Endpoints ********/
    async execute(hubReq) {
        const wrappedResp = new wrapped_response_1.WrappedResponse(Hub.ActionResponse);
        const log = this.makeLogger(hubReq.webhookId);
        try {
            const adsRequest = await ads_request_1.GoogleAdsActionRequest.fromHub(hubReq, this, log);
            await adsRequest.execute();
            log("info", "Execution complete");
            return wrappedResp.returnSuccess(adsRequest.userState);
        }
        catch (err) {
            (0, error_utils_1.sanitizeError)(err);
            (0, error_utils_1.makeBetterErrorMessage)(err, hubReq.webhookId);
            log("error", "Execution error toString:", err.toString());
            log("error", "Execution error JSON:", JSON.stringify(err));
            return wrappedResp.returnError(err);
        }
    }
    async form(hubReq) {
        const wrappedResp = new wrapped_response_1.WrappedResponse(Hub.ActionForm);
        const log = this.makeLogger(hubReq.webhookId);
        try {
            const adsWorker = await ads_request_1.GoogleAdsActionRequest.fromHub(hubReq, this, log);
            wrappedResp.form = await adsWorker.makeForm();
            return wrappedResp.returnSuccess(adsWorker.userState);
            // Use this code if you need to force a state reset and redo oauth login
            // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
            // wrappedResp.resetState()
            // return wrappedResp.returnSuccess()
        }
        catch (err) {
            (0, error_utils_1.sanitizeError)(err);
            const loginForm = await this.oauthHelper.makeLoginForm(hubReq);
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
                log("error", `Error loading target account with request: ${err.response.request.responseURL}. `
                    + `${err.response.data[0].error.details[0].errors[0].message}`);
                return wrappedResp.returnError(err);
            }
            // Other errors from the API client - typically an auth problem
            if (err.code) {
                loginForm.fields[0].label =
                    `Received error code ${err.code} from the API, so your credentials have been discarded.`
                        + " Please reauthenticate and try again.";
                log("error", `Received error code ${err.code} from the API, credentials have been discarded.`);
                return loginForm;
            }
            // All other errors
            wrappedResp.errorPrefix = "Form generation error: ";
            log("error", `Form generation error, code: ${err.code}.`);
            return wrappedResp.returnError(err);
        }
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
