import { Action, RouteBuilder } from "./action";
import { ActionRequest } from "./action_request";
export declare abstract class OAuthAction extends Action {
    abstract oauthCheck(request: ActionRequest): Promise<boolean>;
    abstract oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    abstract oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    asJson(router: RouteBuilder, request: ActionRequest): any;
}
export declare function isOauthAction(action: Action): boolean;
