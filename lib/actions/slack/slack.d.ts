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
    /**
     * Executes the Slack action.
     * Decrypts state_json if it was previously encrypted and passes it to the client manager.
     * If execution succeeds and the feature flag is on, it encrypts the state before returning.
     */
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    /**
     * Retrieves the form fields for the action.
     * Decrypts state_json before creating clients to fetch available workspaces.
     * If the response state needs to be maintained, it encrypts it before sending it back to Looker.
     */
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    loginForm(request: Hub.ActionRequest, form?: Hub.ActionForm): Promise<Hub.ActionForm>;
    /**
     * Checks if the OAuth connection is valid.
     * Opportunistically decrypts the state and returns whether the connection holds.
     */
    oauthCheck(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    authTest(clients: WebClient[]): Promise<any[]>;
    /**
     * Decrypts the state_json parsing it as plain text if decryption fails.
     * This ensures backward compatibility with older, unencrypted states.
     */
    private decryptStateIfNeeded;
    /**
     * Encrypts the state_json string if the feature flag is enabled.
     * Returns the encrypted string or the original state if encryption fails or is disabled.
     */
    private encryptStateJson;
}
