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
    /**
     * Extracts token state from a JSON string.
     * - If parsing fails, returns null.
     * - If encryption markers are present, attempts to decrypt.
     * - Otherwise, returns the unencrypted JSON object.
     */
    oauthExtractTokensFromStateJson(stateJson: string, requestWebhookId: string | undefined): Promise<any>;
    /**
     * Conditionally encrypts token payloads based on the per-action environment config.
     * - If `ENCRYPT_PAYLOAD_<ACTION_NAME>` is "true", returns an EncryptedPayload.
     * - Otherwise, returns the raw JSON object so standard libraries like gaxios can set the correct Content-Type header.
     */
    oauthMaybeEncryptTokens(tokenPayload: any, requestWebhookId: string | undefined): Promise<EncryptedPayload | any>;
    oauthDecryptTokens(encryptedPayload: EncryptedPayload, requestWebhookId: string | undefined): Promise<Record<string, any>>;
}
export declare function isOauthAction(action: Action): boolean;
