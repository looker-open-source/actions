import * as Hub from "../../hub";
export declare class MarketoAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    params: {
        description: string;
        label: string;
        name: string;
        required: boolean;
        sensitive: boolean;
    }[];
    supportedActionTypes: Hub.ActionType[];
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    usesStreaming: boolean;
    executeInOwnProcess: boolean;
    supportedFormats: (request: Hub.ActionRequest) => Hub.ActionFormat[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
}
