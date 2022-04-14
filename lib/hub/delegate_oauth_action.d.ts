import { Action, ActionParameter, RouteBuilder } from "./action";
import { ActionForm } from "./action_form";
import { ActionRequest } from "./action_request";
export interface DelegateOauthActionParameter extends ActionParameter {
    delegate_oauth_url: string;
}
export declare abstract class DelegateOAuthAction extends Action {
    abstract params: DelegateOauthActionParameter[];
    abstract oauthCheck(request: ActionRequest): Promise<ActionForm>;
    asJson(router: RouteBuilder, request: ActionRequest): any;
}
export declare function isDelegateOauthAction(action: Action): boolean;
