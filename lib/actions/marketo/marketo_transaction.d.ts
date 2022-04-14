import * as Hub from "../../hub";
interface Result {
    leads: any[];
    skipped: any[];
    leadErrors: any[];
    membershipErrors: any[];
}
export declare class MarketoTransaction {
    fieldMap: any;
    marketo: any;
    campaignIds: string[];
    addListIds: string[];
    removeListIds: string[];
    lookupField?: string;
    handleRequest(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    processChunk(chunk: any[]): Promise<Result>;
    marketoClientFromRequest(request: Hub.ActionRequest): any;
    private getFieldMap;
    private getLeadList;
    private hasErrors;
    private getErrorMessage;
    private getSkippedReasons;
}
export {};
