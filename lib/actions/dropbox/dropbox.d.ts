import { Dropbox } from "dropbox";
import * as Hub from "../../hub";
export declare class DropboxAction extends Hub.OAuthAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    usesStreaming: boolean;
    minimumSupportedLookerVersion: string;
    requiredFields: never[];
    params: never[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    oauthCheck(request: Hub.ActionRequest): Promise<boolean>;
    dropboxFilename(request: Hub.ActionRequest): string | undefined;
    /**
     * Exchanges the authorization code for an access token with Dropbox.
     * Parameters are sent in the request body as application/x-www-form-urlencoded
     * to comply with RFC 6749 and avoid leaking secrets in URL logs (b/426567813).
     */
    protected getAccessTokenFromCode(stateJson: any): Promise<any>;
    protected dropboxClientFromRequest(request: Hub.ActionRequest, token: string): Promise<Dropbox>;
}
