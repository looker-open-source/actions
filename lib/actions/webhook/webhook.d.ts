import * as Hub from "../../hub";
export declare abstract class WebhookAction extends Hub.Action {
    abstract domain: string;
    requiredFields: never[];
    params: never[];
    supportedActionTypes: Hub.ActionType[];
    usesStreaming: boolean;
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    supportedFormats: Hub.ActionFormat[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
}
