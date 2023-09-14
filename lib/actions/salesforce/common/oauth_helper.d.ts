import * as jsforce from "jsforce";
import * as Hub from "../../../hub";
import { Tokens } from "../campaigns/salesforce_campaigns";
export declare class SalesforceOauthHelper {
    readonly oauthCreds: {
        oauthClientId: string;
        oauthClientSecret: string;
    };
    constructor(oauthClientId: string, oauthClientSecret: string);
    makeLoginForm(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    /******** Handlers for Hub.OAuthAction endpoints ********/
    oauthUrl(redirectUri: string, encryptedPayload: string): Promise<string>;
    oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    getAccessTokensFromAuthCode(stateJson: any): Promise<{
        access_token: string;
        refresh_token: string;
    }>;
}
/******** function to create jsforce connection used in formBuilder and sendData ********/
export declare const sfdcConnFromRequest: (request: Hub.ActionRequest, tokens: Tokens, oauthCreds: {
    oauthClientId: string;
    oauthClientSecret: string;
}) => Promise<jsforce.Connection>;
export declare const salesforceLogin: (request: Hub.ActionRequest) => Promise<jsforce.Connection>;
