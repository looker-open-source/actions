import * as Hub from "../../hub";
export declare class DataRobotAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    requiredFields: never[];
    usesStreaming: boolean;
    params: {
        name: string;
        label: string;
        description: string;
        required: boolean;
        sensitive: boolean;
    }[];
    minimumSupportedLookerVersion: string;
    private dataRobotUrl;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    private getDataRobotApiUrl;
    private validateDataRobotToken;
    private prettyDataRobotError;
}
