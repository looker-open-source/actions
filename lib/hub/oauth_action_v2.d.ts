import { Action, RouteBuilder } from "./action";
import { ActionRequest } from "./action_request";
import { EncryptedPayload } from "./encrypted_payload";
import { TokenPayload } from "./token_payload";
export declare abstract class OAuthActionV2 extends Action {
    abstract oauthCheck(request: ActionRequest): Promise<boolean>;
    abstract oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    abstract oauthHandleRedirect(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<string>;
    abstract oauthFetchAccessToken(request: ActionRequest): Promise<EncryptedPayload | TokenPayload>;
    asJson(router: RouteBuilder, request: ActionRequest): any;
}
export declare function isOauthActionV2(action: Action): boolean;
