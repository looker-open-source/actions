import { AESTransitCrypto as ActionCrypto } from "../crypto/aes_transit_crypto";
import { Action, RouteBuilder } from "./action";
import { ActionRequest } from "./action_request";
import { EncryptedPayload } from "./encrypted_payload";
export declare abstract class OAuthAction extends Action {
    protected static readonly actionCrypto: ActionCrypto;
    abstract oauthCheck(request: ActionRequest): Promise<boolean>;
    abstract oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    abstract oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    asJson(router: RouteBuilder, request: ActionRequest): any;
    oauthExtractTokensFromStateJson(stateJson: string, requestWebhookId: string | undefined): Promise<any>;
    oauthMaybeEncryptTokens(tokenPayload: any, requestWebhookId: string | undefined): Promise<EncryptedPayload | string>;
    oauthDecryptTokens(encryptedPayload: EncryptedPayload, requestWebhookId: string | undefined): Promise<Record<string, any>>;
}
export declare function isOauthAction(action: Action): boolean;
