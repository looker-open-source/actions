import * as winston from "winston";
import * as Hub from "../../../hub";
import { GoogleOAuthHelper, UseGoogleOAuthHelper } from "../common/oauth_helper";
export declare class GoogleAnalyticsDataImportAction extends Hub.OAuthAction implements UseGoogleOAuthHelper {
    /******** Action properties ********/
    readonly name = "google_analytics_data_import";
    readonly label = "Google Analytics Data Import";
    readonly iconName = "google/analytics/google_analytics_icon.svg";
    readonly description = "Upload data to a custom Data Set in Google Analytics.";
    readonly supportedActionTypes: Hub.ActionType[];
    readonly supportedFormats: Hub.ActionFormat[];
    readonly supportedFormattings: Hub.ActionFormatting[];
    readonly supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    readonly supportedDownloadSettings: Hub.ActionDownloadSettings[];
    readonly usesStreaming = true;
    readonly requiredFields: never[];
    readonly params: never[];
    /******** OAuth properties ********/
    readonly redirectUri: string;
    readonly oauthClientId: string;
    readonly oauthClientSecret: string;
    readonly oauthScopes: string[];
    readonly oauthHelper: GoogleOAuthHelper;
    /******** Constructor & some helpers ********/
    constructor(oauthClientId: string, oauthClientSecret: string);
    makeLogger(webhookId?: string): (level: string, ...rest: any[]) => winston.LoggerInstance;
    makeOAuthClient(redirect?: string): import("google-auth-library").OAuth2Client;
    sanitizeError(err: any): void;
    /******** Endpoints for Hub.OAuthAction ********/
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    oauthCheck(_request: Hub.ActionRequest): Promise<boolean>;
    /******** Main Action Endpoints ********/
    execute(hubReq: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(hubReq: Hub.ActionRequest): Promise<Hub.ActionForm>;
}
