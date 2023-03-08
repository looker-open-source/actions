/// <reference types="node" />
/// <reference types="node" />
import * as express from "express";
import { Readable } from "stream";
import { DataWebhookPayload, DataWebhookPayloadType as ActionType } from "../api_types/data_webhook_payload";
import { DataWebhookPayloadScheduledPlanType } from "../api_types/data_webhook_payload_scheduled_plan";
import { IntegrationSupportedDownloadSettings as ActionDownloadSettings, IntegrationSupportedFormats as ActionFormat, IntegrationSupportedFormattings as ActionFormatting, IntegrationSupportedVisualizationFormattings as ActionVisualizationFormatting } from "../api_types/integration";
import { Query } from "../api_types/query";
import { Fieldset } from "./index";
import { Row as JsonDetailRow } from "./json_detail";
export { ActionType, ActionFormat, ActionFormatting, ActionVisualizationFormatting, ActionDownloadSettings, };
export interface ParamMap {
    [name: string]: string | undefined;
}
export interface ActionAttachment {
    dataBuffer?: Buffer;
    encoding?: BufferEncoding;
    dataJSON?: any;
    mime?: string;
    fileExtension?: string;
}
export interface ActionScheduledPlan {
    /** ID of the scheduled plan */
    scheduledPlanId?: number | null;
    /** Title of the scheduled plan. */
    title?: string | null;
    /** Type of content of the scheduled plan. Valid values are: "Look", "Dashboard". */
    type?: DataWebhookPayloadScheduledPlanType;
    /** URL of the content item in Looker. */
    url?: string | null;
    /** ID of the query that the data payload represents. */
    queryId?: number | null;
    /** Query that was run (not available for dashboards) */
    query?: Query | null;
    /** A boolean representing whether this schedule payload has customized the filter values. */
    filtersDifferFromLook?: boolean;
    /** A string to be included in scheduled integrations if this scheduled plan is a download query */
    downloadUrl?: string | null;
}
export declare class ActionRequest {
    static fromRequest(request: express.Request): ActionRequest;
    static fromIPC(json: any): ActionRequest;
    static fromJSON(json?: DataWebhookPayload): ActionRequest;
    attachment?: ActionAttachment;
    formParams: ParamMap;
    params: ParamMap;
    scheduledPlan?: ActionScheduledPlan;
    type: ActionType;
    actionId?: string;
    instanceId?: string;
    webhookId?: string;
    lookerVersion: string | null;
    empty(): boolean;
    /** `stream` creates and manages a stream of the request data
     *
     * ```ts
     * let prom = await request.stream(async (readable) => {
     *    return myService.uploadStreaming(readable).promise()
     * })
     * ```
     *
     * Streaming generally occurs only if Looker sends the data in a streaming fashion via a push url,
     * however it will also wrap non-streaming attachment data so that actions only need a single implementation.
     *
     * @returns A promise returning the same value as the callback's return value.
     * This promise will resolve after the stream has completed and the callback's promise
     * has also resolved.
     * @param callback A function will be caled with a Node.js `Readable` object.
     * The readable object represents the streaming data.
     */
    stream<T>(callback: (readable: Readable) => Promise<T>): Promise<T>;
    /**
     * A streaming helper for the "json" data format. It handles automatically parsing
     * the JSON in a streaming fashion. You just need to implement a function that will
     * be called for each row.
     *
     * ```ts
     * await request.streamJson((row) => {
     *   // This will be called for each row of data
     * })
     * ```
     *
     * @returns A promise that will be resolved when streaming is complete.
     * @param onRow A function that will be called for each streamed row, with the row as the first argument.
     */
    streamJson(onRow: (row: {
        [fieldName: string]: any;
    }) => void): Promise<void>;
    /**
     * A streaming helper for the "json_detail" data format. It handles automatically parsing
     * the JSON in a streaming fashion. You can implement an `onFields` callback to get
     * the field metadata, and an `onRow` callback for each row of data.
     *
     * ```ts
     * await request.streamJsonDetail({
     *   onFields: (fields) => {
     *     // This will be called when fields are available
     *   },
     *   onRow: (row) => {
     *     // This will be called for each row of data
     *   },
     * })
     * ```
     *
     * @returns A promise that will be resolved when streaming is complete.
     * @param callbacks An object consisting of several callbacks that will be called
     * when various parts of the data are parsed.
     */
    streamJsonDetail(callbacks: {
        onRow: (row: JsonDetailRow) => void;
        onFields?: (fields: Fieldset) => void;
        onRanAt?: (iso8601string: string) => void;
    }): Promise<void>;
    suggestedFilename(): any;
    /** Returns filename with whitespace removed and the file extension included
     */
    completeFilename(): any;
    /** creates a truncated message with a max number of lines and max number of characters with Title, Url,
     * and truncated Body of payload
     * @param {number} maxLines - maximum number of lines to truncate message
     * @param {number} maxCharacters - maximum character to truncate
     */
    suggestedTruncatedMessage(maxLines: number, maxCharacters: number): string | undefined;
    private get logInfo();
    private safeOboe;
}
