import * as googleAuth from "google-auth-library";
import * as Hub from "../../../hub";
import { Logger } from "./logger";
export interface UseGoogleOAuthHelper {
    oauthClientId: string;
    oauthClientSecret: string;
    oauthScopes: string[];
    makeOAuthClient(): googleAuth.OAuth2Client;
}
export declare class GoogleOAuthHelper {
    readonly actionInstance: UseGoogleOAuthHelper & Hub.OAuthAction;
    readonly log: Logger;
    /******** Contsructor & public helpers ********/
    constructor(actionInstance: UseGoogleOAuthHelper & Hub.OAuthAction, log: Logger);
    makeOAuthClient(redirectUri: string | undefined): googleAuth.OAuth2Client;
    makeLoginForm(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    /******** Handlers for Hub.OAuthAction endpoints ********/
    oauthUrl(redirectUri: string, encryptedPayload: string): Promise<string>;
    oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    /******** Helper for ad hoc token refresh ********/
    refreshAccessToken(currentTokens: googleAuth.Credentials): Promise<any>;
}
