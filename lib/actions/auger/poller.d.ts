export interface Transaction {
    projectId: number;
    s3Path: string;
    fileName: string;
    columns: {
        [key: string]: any;
    };
    token: any;
    params: {
        [key: string]: any;
    };
    contentType: string;
    augerURL: string;
    successStatus: string;
    errorStatus: string;
    pollFunction?: (transaction: Transaction) => Promise<any>;
    callbackFunction?: (transaction: Transaction) => Promise<any>;
    projectFileId: number;
    experimentId: number;
}
export interface FileInfo {
    fileName: string;
    projectName?: string;
    filePath: string;
    token?: string;
    chunkRecords: any[];
    allFields?: {
        [key: string]: any;
    };
    fieldMap: any[];
}
export declare class Poller {
    intervalTimer: any;
    timeoutTimer: any;
    constructor(transaction: Transaction);
    pollTrainingJob(transaction: Transaction): Promise<void>;
    checkStatus(transaction: Transaction): Promise<void>;
    stopPolling(): void;
    logRejection(err: any): void;
}
