import Dropbox = require("dropbox");
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
    protected getAccessTokenFromCode(stateJson: any): Promise<any>;
    protected dropboxClientFromRequest(request: Hub.ActionRequest, token: string): Dropbox;
}
