import { EncryptedPayload } from ".";
import { Action, RouteBuilder } from "./action";
import { ActionRequest } from "./action_request";
export declare abstract class OAuthAction extends Action {
    abstract oauthCheck(request: ActionRequest): Promise<boolean>;
    abstract oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    abstract oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    asJson(router: RouteBuilder, request: ActionRequest): any;
    oauthExtractTokensFromStateJson(stateJson: string, requestWebhookId: string | undefined): Promise<any>;
    oauthMaybeEncryptTokens(tokenPayload: any, requestWebhookId: string | undefined): Promise<EncryptedPayload | string>;
    oauthDecryptTokens(encryptedPayload: EncryptedPayload, requestWebhookId: string | undefined): Promise<any>;
}
export declare function isOauthAction(action: Action): boolean;
