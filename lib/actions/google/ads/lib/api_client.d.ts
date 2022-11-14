import { Logger } from "../../common/logger";
export declare class GoogleAdsApiClient {
    readonly log: Logger;
    readonly accessToken: string;
    readonly developerToken: string;
    readonly loginCid?: string | undefined;
    constructor(log: Logger, accessToken: string, developerToken: string, loginCid?: string | undefined);
    listAccessibleCustomers(): Promise<any>;
    searchOpenUserLists(clientCid: string, uploadKeyType: "MOBILE_ADVERTISING_ID" | "CONTACT_INFO"): Promise<any>;
    searchClientCustomers(clientCid: string): Promise<any>;
    createUserList(targetCid: string, newListName: string, newListDescription: string, uploadKeyType: "MOBILE_ADVERTISING_ID" | "CONTACT_INFO", mobileAppId?: string): Promise<any>;
    createDataJob(targetCid: string, userListResourceName: string): Promise<any>;
    addDataJobOperations(offlineUserDataJobResourceName: string, userIdentifiers: any[]): Promise<any>;
    runJob(offlineUserDataJobResourceName: string): Promise<any>;
    apiCall(method: "GET" | "POST", url: string, data?: any): Promise<any>;
}
