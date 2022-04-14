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
exports.GoogleAnalyticsDataImportAction = void 0;
const winston = require("winston");
const Hub = require("../../../hub");
const missing_auth_error_1 = require("../common/missing_auth_error");
const oauth_helper_1 = require("../common/oauth_helper");
const wrapped_response_1 = require("../common/wrapped_response");
const ga_worker_1 = require("./lib/ga_worker");
const LOG_PREFIX = "[GA Data Import]";
class GoogleAnalyticsDataImportAction extends Hub.OAuthAction {
    /******** Constructor & some helpers ********/
    constructor(oauthClientId, oauthClientSecret) {
        super();
        /******** Action properties ********/
        this.name = "google_analytics_data_import";
        this.label = "Google Analytics Data Import";
        this.iconName = "google/analytics/google_analytics_icon.svg";
        this.description = "Upload data to a custom Data Set in Google Analytics.";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.Csv];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.supportedDownloadSettings = [Hub.ActionDownloadSettings.Url];
        this.usesStreaming = true;
        this.requiredFields = [];
        this.params = [];
        /******** OAuth properties ********/
        this.redirectUri = `${process.env.ACTION_HUB_BASE_URL}/actions/${encodeURIComponent(this.name)}/oauth_redirect`;
        this.oauthScopes = ["https://www.googleapis.com/auth/analytics.edit"];
        this.oauthClientId = oauthClientId;
        this.oauthClientSecret = oauthClientSecret;
        this.oauthHelper = new oauth_helper_1.GoogleOAuthHelper(this, this.makeLogger("oauth"));
    }
    makeLogger(webhookId = "") {
        return (level, ...rest) => {
            return winston.log(level, LOG_PREFIX, `[webhookID=${webhookId}]`, ...rest);
        };
    }
    makeOAuthClient(redirect) {
        redirect = redirect ? redirect : this.redirectUri;
        return this.oauthHelper.makeOAuthClient(redirect);
    }
    sanitizeError(err) {
        const configObjs = [];
        if (err.config) {
            configObjs.push(err.config);
        }
        if (err.response && err.response.config) {
            configObjs.push(err.response.config);
        }
        for (const config of configObjs) {
            for (const prop of ["data", "body"]) {
                if (config[prop]) {
                    config[prop] = "[REDACTED]";
                }
            }
        }
    }
    /******** Endpoints for Hub.OAuthAction ********/
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
    /******** Main Action Endpoints ********/
    execute(hubReq) {
        return __awaiter(this, void 0, void 0, function* () {
            const wrappedResp = new wrapped_response_1.WrappedResponse(Hub.ActionResponse);
            const log = this.makeLogger(hubReq.webhookId);
            let currentStep = "action setup";
            try {
                // The worker constructor will do a bunch of validation for us
                const gaWorker = yield ga_worker_1.GoogleAnalyticsActionWorker.fromHubRequest(hubReq, this, log);
                currentStep = "Data upload step";
                yield gaWorker.uploadData();
                log("info", `${currentStep} completed.`);
                log("debug", "New upload id=", gaWorker.newUploadId);
                // Since the upload was successful, update the lastUsedFormParams in user state
                gaWorker.setLastUsedFormParams();
                wrappedResp.setUserState(gaWorker.userState);
                if (gaWorker.isDeleteOtherFiles) {
                    currentStep = "Delete other files step";
                    yield gaWorker.deleteOtherFiles();
                    log("info", `${currentStep} completed.`);
                }
                // All is well if we made it this far
                log("info", "Execution completed successfully.");
                return wrappedResp.returnSuccess();
            }
            catch (err) {
                this.sanitizeError(err);
                log("error", "Execution error:", err.toString());
                log("error", "Exeuction errror JSON:", JSON.stringify(err));
                wrappedResp.errorPrefix = `Error during ${currentStep.toLowerCase()}: `;
                return wrappedResp.returnError(err);
            }
        });
    }
    form(hubReq) {
        return __awaiter(this, void 0, void 0, function* () {
            const wrappedResp = new wrapped_response_1.WrappedResponse(Hub.ActionForm);
            const log = this.makeLogger(hubReq.webhookId);
            try {
                const gaWorker = yield ga_worker_1.GoogleAnalyticsActionWorker.fromHubRequest(hubReq, this, log);
                wrappedResp.form = yield gaWorker.makeForm();
                log("info", "Form generation complete");
                return wrappedResp.returnSuccess();
                // Use this code if you need to force a state reset and redo oauth login
                // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
                // wrappedResp.resetState()
                // return wrappedResp.returnSuccess()
            }
            catch (err) {
                this.sanitizeError(err);
                const loginForm = yield this.oauthHelper.makeLoginForm(hubReq);
                if (err instanceof missing_auth_error_1.MissingAuthError) {
                    log("info", "Caught MissingAuthError; returning login form.");
                    return loginForm;
                }
                else {
                    log("error", "Form error:", err.toString());
                    log("error", "Form error JSON:", JSON.stringify(err));
                    loginForm.fields[0].label =
                        `Received an error (code ${err.code}) from the API, so your credentials have been discarded.`
                            + " Please reauthenticate and try again.";
                    return loginForm;
                }
            }
        });
    }
}
exports.GoogleAnalyticsDataImportAction = GoogleAnalyticsDataImportAction;
/******** Register with Hub if prereqs are satisfied ********/
if (process.env.GOOGLE_ANALYTICS_CLIENT_ID && process.env.GOOGLE_ANALYTICS_CLIENT_SECRET) {
    const gadi = new GoogleAnalyticsDataImportAction(process.env.GOOGLE_ANALYTICS_CLIENT_ID, process.env.GOOGLE_ANALYTICS_CLIENT_SECRET);
    Hub.addAction(gadi);
}
else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`);
}
