import { WebClient } from "@slack/web-api";
import * as Hub from "../../hub";
export declare class SlackAction extends Hub.DelegateOAuthAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    requiredFields: never[];
    params: {
        name: string;
        label: string;
        delegate_oauth_url: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    minimumSupportedLookerVersion: string;
    usesStreaming: boolean;
    executeInOwnProcess: boolean;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    loginForm(request: Hub.ActionRequest, form?: Hub.ActionForm): Promise<Hub.ActionForm>;
    oauthCheck(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    authTest(clients: WebClient[]): Promise<any[]>;
}
