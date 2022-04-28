import * as Hub from "../../hub";
export declare class FacebookCustomAudiencesAction extends Hub.OAuthAction {
    readonly name = "facebook_custom_audiences";
    readonly label = "Facebook Custom Audiences";
    readonly iconName = "facebook/facebook_ads_icon.png";
    readonly description = "Upload data to Facebook Ads Custom Audiences from Customer List";
    readonly supportedActionTypes: Hub.ActionType[];
    readonly supportedFormats: Hub.ActionFormat[];
    readonly supportedFormattings: Hub.ActionFormatting[];
    readonly supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    readonly supportedDownloadSettings: Hub.ActionDownloadSettings[];
    readonly usesStreaming = true;
    readonly requiredFields: never[];
    readonly params: never[];
    executeInOwnProcess: boolean;
    readonly oauthClientId: string;
    readonly oauthClientSecret: string;
    readonly oauthScope: string;
    constructor(oauthClientId: string, oauthClientSecret: string);
    execute(hubRequest: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(hubRequest: Hub.ActionRequest): Promise<Hub.ActionForm>;
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    oauthCheck(request: Hub.ActionRequest): Promise<boolean>;
    protected getAccessTokenFromRequest(request: Hub.ActionRequest): Promise<string | null>;
}
