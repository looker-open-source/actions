import * as Hub from "../../hub";
import * as gaxios from "gaxios";
export declare class AirtableAction extends Hub.OAuthAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    params: never[];
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    SCOPE: string;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    checkBaseList(token: string): Promise<gaxios.GaxiosResponse<unknown>>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    oauthCheck(_request: Hub.ActionRequest): Promise<boolean>;
    oauthFetchInfo(urlParams: {
        [p: string]: string;
    }, redirectUri: string): Promise<void>;
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    private airtableClientFromRequest;
    private refreshTokens;
    private executeAirtable;
}
