import * as winston from "winston";
import * as Hub from "../../../hub";
import { GoogleOAuthHelper, UseGoogleOAuthHelper } from "../common/oauth_helper";
export declare class GoogleAdsCustomerMatch extends Hub.OAuthAction implements UseGoogleOAuthHelper {
    /******** Core action properties ********/
    readonly name = "google_ads_customer_match";
    readonly label = "Google Ads Customer Match";
    readonly iconName = "google/ads/google_ads_icon.svg";
    readonly description = "Upload data to Google Ads Customer Match.";
    readonly supportedActionTypes: Hub.ActionType[];
    readonly supportedFormats: Hub.ActionFormat[];
    readonly supportedFormattings: Hub.ActionFormatting[];
    readonly supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    readonly supportedDownloadSettings: Hub.ActionDownloadSettings[];
    readonly usesStreaming = true;
    readonly requiredFields: never[];
    readonly params: never[];
    /******** Other fields + OAuth stuff ********/
    readonly redirectUri: string;
    readonly developerToken: string;
    readonly oauthClientId: string;
    readonly oauthClientSecret: string;
    readonly oauthScopes: string[];
    readonly oauthHelper: GoogleOAuthHelper;
    /******** Constructor & Helpers ********/
    constructor(oauthClientId: string, oauthClientSecret: string, developerToken: string);
    makeLogger(webhookId?: string): (level: string, ...rest: any[]) => winston.LoggerInstance;
    makeOAuthClient(): import("google-auth-library").OAuth2Client;
    /******** OAuth Endpoints ********/
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    oauthCheck(_request: Hub.ActionRequest): Promise<boolean>;
    /******** Action Endpoints ********/
    execute(hubReq: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(hubReq: Hub.ActionRequest): Promise<Hub.ActionForm>;
}
