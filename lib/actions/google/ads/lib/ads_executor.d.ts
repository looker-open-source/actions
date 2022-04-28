import { GoogleAdsActionRequest } from "./ads_request";
export declare class GoogleAdsActionExecutor {
    readonly adsRequest: GoogleAdsActionRequest;
    readonly apiClient: import("./api_client").GoogleAdsApiClient;
    readonly log: import("../../common/logger").Logger;
    readonly targetCid: any;
    readonly mobileAppId: any;
    readonly uploadKeyType: string;
    offlineUserDataJobResourceName: string;
    targetUserListRN: string;
    constructor(adsRequest: GoogleAdsActionRequest);
    createUserList(newListName: string, newListDescription: string): Promise<void>;
    createDataJob(): Promise<any>;
    uploadData(): Promise<void>;
    addDataJobOperations(userIdentifiers: any[]): Promise<any>;
    runJob(): Promise<any>;
}
