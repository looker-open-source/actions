import { Credentials } from "google-auth-library";
import { analytics_v3 } from "googleapis";
import * as Hub from "../../../../hub";
import { Logger } from "../../common/logger";
import { GoogleAnalyticsDataImportAction } from "../data_import";
interface GAUserState {
    tokens: Credentials;
    redirect: string;
    lastUsedFormParams: any;
}
export declare class GoogleAnalyticsActionWorker {
    readonly hubRequest: Hub.ActionRequest;
    readonly actionInstance: GoogleAnalyticsDataImportAction;
    readonly log: Logger;
    static fromHubRequest(hubRequest: Hub.ActionRequest, actionInstance: GoogleAnalyticsDataImportAction, logger: Logger): Promise<GoogleAnalyticsActionWorker>;
    gaClient: analytics_v3.Analytics;
    userState: GAUserState;
    formParams: any;
    newUploadId?: string;
    constructor(hubRequest: Hub.ActionRequest, actionInstance: GoogleAnalyticsDataImportAction, log: Logger);
    makeGAClient(): analytics_v3.Analytics;
    get redirect(): string;
    get tokens(): Credentials;
    get dataSourceCompositeId(): any;
    get dataSourceSchema(): any;
    get isDeleteOtherFiles(): boolean;
    get lastUsedFormParams(): any;
    getEntityIds(): any;
    setLastUsedFormParams(): void;
    uploadData(): Promise<void>;
    deleteOtherFiles(): Promise<import("gaxios").GaxiosResponse<void> | undefined>;
    makeForm(): Promise<Hub.ActionForm>;
    getDataSetSelectOptions(accountSummaries: analytics_v3.Schema$AccountSummary[]): Promise<{
        name: string;
        label: string;
    }[]>;
}
export {};
