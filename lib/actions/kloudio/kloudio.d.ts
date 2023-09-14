import * as Hub from "../../hub";
export declare class KloudioAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    params: never[];
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    signedUrl: any;
    API_URL: any;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
    protected generateAnonymousId(): string;
}
