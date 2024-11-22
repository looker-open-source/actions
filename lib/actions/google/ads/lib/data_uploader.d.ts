import { GoogleAdsActionExecutor } from "./ads_executor";
export declare class GoogleAdsUserListUploader {
    readonly adsExecutor: GoogleAdsActionExecutor;
    readonly adsRequest: import("./ads_request").GoogleAdsActionRequest;
    readonly doHashingBool: boolean;
    readonly log: import("../../common/logger").Logger;
    private batchPromises;
    private batchQueue;
    private currentRequest;
    private isSchemaDetermined;
    private rowQueue;
    private schema;
    private regexes;
    constructor(adsExecutor: GoogleAdsActionExecutor);
    private get batchIsReady();
    private get numBatches();
    run(): Promise<void>;
    private startAsyncParser;
    private determineSchema;
    private handleRow;
    private transformRow;
    private normalizeAndHash;
    private scheduleBatch;
    private sendBatch;
}
