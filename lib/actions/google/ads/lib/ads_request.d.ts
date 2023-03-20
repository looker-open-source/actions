import { Credentials } from "google-auth-library";
import * as Hub from "../../../../hub";
import { Logger } from "../../common/logger";
import { GoogleAdsCustomerMatch } from "../customer_match";
import { GoogleAdsApiClient } from "./api_client";
interface AdsUserState {
    tokens: Credentials;
    redirect: string;
}
export declare class GoogleAdsActionRequest {
    readonly hubRequest: Hub.ActionRequest;
    readonly actionInstance: GoogleAdsCustomerMatch;
    readonly log: Logger;
    static fromHub(hubRequest: Hub.ActionRequest, action: GoogleAdsCustomerMatch, logger: Logger): Promise<GoogleAdsActionRequest>;
    readonly streamingDownload: <T>(callback: (readable: import("stream").Readable) => Promise<T>) => Promise<T>;
    apiClient?: GoogleAdsApiClient;
    formParams: any;
    userState: AdsUserState;
    webhookId?: string;
    constructor(hubRequest: Hub.ActionRequest, actionInstance: GoogleAdsCustomerMatch, log: Logger);
    checkTokens(): Promise<void>;
    setApiClient(): void;
    get accessToken(): string;
    get createOrAppend(): any;
    get mobileDevice(): any;
    get isMobileDevice(): boolean;
    get mobileAppId(): any;
    get uploadKeyType(): "MOBILE_ADVERTISING_ID" | "CONTACT_INFO";
    get developerToken(): string;
    get doHashingBool(): boolean;
    get isCreate(): boolean;
    get loginCid(): any;
    get targetCid(): any;
    get targetUserListRN(): any;
    makeForm(): Promise<Hub.ActionForm>;
    execute(): Promise<void>;
}
export {};
