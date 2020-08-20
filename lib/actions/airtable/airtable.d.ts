import * as Hub from "../../hub";
export declare class AirtableAction extends Hub.Action {
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
    supportedFormats: Hub.ActionFormat[];
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
    private airtableClientFromRequest;
}
