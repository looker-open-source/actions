import { GaxiosResponse } from "gaxios";
import { Credentials, OAuth2Client } from "google-auth-library";
import { drive_v3 } from "googleapis";
import * as Hub from "../../../hub";
import Drive = drive_v3.Drive;
interface OauthState {
    tokenurl?: string;
    stateurl?: string;
}
export declare class GoogleDriveAction extends Hub.OAuthActionV2 {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    usesStreaming: boolean;
    minimumSupportedLookerVersion: string;
    requiredFields: never[];
    params: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    mimeType: string | undefined;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    oauthHandleRedirect(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<string>;
    oauthFetchAccessToken(request: Hub.ActionRequest): Promise<Hub.ActionToken | Hub.EncryptedPayload>;
    oauthCheck(request: Hub.ActionRequest): Promise<boolean>;
    oauth2Client(redirectUri: string | undefined): OAuth2Client;
    sendData(filename: string, request: Hub.ActionRequest, drive: Drive): Promise<GaxiosResponse<drive_v3.Schema$File>>;
    getDrives(drive: Drive, accumulatedFolders: drive_v3.Schema$Drive[], response: GaxiosResponse<drive_v3.Schema$DriveList>): Promise<drive_v3.Schema$Drive[]>;
    getMimeType(request: Hub.ActionRequest): string | undefined;
    sanitizeGaxiosError(err: any): void;
    protected getAccessTokenCredentialsFromCode(redirect: string, code: string): Promise<Credentials>;
    protected driveClientFromRequest(redirect: string, tokens: Credentials): Promise<drive_v3.Drive>;
    protected getUserEmail(redirect: string, tokens: Credentials): Promise<string>;
    protected validateUserInDomainAllowlist(domainAllowlist: string | undefined, redirect: string, tokens: Credentials, requestWebhookId: string | undefined): Promise<void>;
    protected oauthExtractTokensFromState(state: any, requestWebhookId: string | undefined): Promise<Hub.ActionToken | null>;
    protected validTokens(tokens: Credentials, requestWebhookId: string | undefined): boolean;
    protected oauthMaybeEncryptTokens(tokenPayload: Hub.ActionToken, actionCrypto: Hub.ActionCrypto, requestWebhookId: string | undefined): Promise<Hub.EncryptedPayload | Hub.ActionToken>;
    protected oauthEncryptTokens(tokenPayload: Hub.ActionToken, actionCrypto: Hub.ActionCrypto, requestWebhookId: string | undefined): Promise<Hub.EncryptedPayload>;
    protected oauthDecryptTokens(encryptedPayload: Hub.EncryptedPayload, actionCrypto: Hub.ActionCrypto, requestWebhookId: string | undefined): Promise<Hub.ActionToken>;
    protected oauthFetchAndStoreInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string, statePayload: OauthState, requestWebhookId: string | undefined): Promise<void>;
    protected oauthCreateLookerRedirectUrl(urlParams: {
        [key: string]: string;
    }, redirectUri: string, actionCrypto: Hub.ActionCrypto, statePayload: OauthState): Promise<string>;
    private loginForm;
}
export {};
