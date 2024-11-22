import * as Hub from "../../hub";
interface BrazeApiRow {
    [key: string]: any;
    external_id?: string;
    braze_id?: string;
    _update_existing_only: boolean;
    looker_export?: {
        add: string[];
    };
}
export declare class BrazeAction extends Hub.Action {
    name: string;
    label: string;
    description: string;
    iconName: string;
    supportedActionTypes: Hub.ActionType[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    supportedFormattings: Hub.ActionFormatting[];
    requiredFields: {
        tag: string;
    }[];
    usesStreaming: boolean;
    executeInOwnProcess: boolean;
    supportedFormats: Hub.ActionFormat[];
    params: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
    sendChunk(endpoint: string, apiKey: string, chunk: BrazeApiRow[]): Promise<void>;
}
export {};
