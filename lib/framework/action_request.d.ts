/// <reference types="node" />
/// <reference types="express" />
import * as express from "express";
export interface IParamMap {
    [name: string]: string | undefined;
}
export declare type ActionType = "cell" | "query" | "dashboard";
export declare type ActionFormat = "assembled_pdf" | "csv" | "html" | "json" | "json_detail" | "inline_json" | "txt" | "wysiwyg_pdf" | "wysiwyg_png" | "xlsx";
export interface IActionAttachment {
    dataBuffer?: Buffer;
    encoding?: string;
    dataJSON?: any;
    mime?: string;
    fileExtension?: string;
}
export interface IActionScheduledPlan {
    filtersDifferFromLook?: boolean;
    queryId?: number;
    scheduledPlanId?: number;
    title?: string;
    type?: string;
    url?: string;
}
export declare class ActionRequest {
    static fromRequest(request: express.Request): ActionRequest;
    static fromJSON(json: any): ActionRequest;
    attachment?: IActionAttachment;
    formParams: IParamMap;
    params: IParamMap;
    scheduledPlan?: IActionScheduledPlan;
    type: ActionType;
    instanceId?: string;
    webhookId?: string;
    suggestedFilename(): string | undefined;
    /** creates a truncated message with a max number of lines and max number of characters with Title, Url,
     * and truncated Body of payload
     * @param {number} maxLines - maximum number of lines to truncate message
     * @param {number} maxCharacters - maximum character to truncate
     */
    suggestedTruncatedMessage(maxLines: number, maxCharacters: number): string | undefined;
}
