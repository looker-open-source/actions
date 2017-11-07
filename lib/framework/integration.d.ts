import { ActionForm, ActionFormat, ActionRequest, ActionResponse, ActionType } from ".";
export interface IIntegrationParameter {
    name: string;
    label: string;
    required: boolean;
    sensitive: boolean;
    description?: string;
}
export interface IRequiredField {
    tag?: string;
    any_tag?: string[];
    all_tags?: string[];
}
export interface Integration {
    action(request: ActionRequest): Promise<ActionResponse>;
    form?(request: ActionRequest): Promise<ActionForm>;
}
export interface IRouteBuilder {
    actionUrl(integration: Integration): string;
    formUrl(integration: Integration): string;
}
export declare abstract class Integration {
    name: string;
    label: string;
    description: string;
    iconName?: string;
    supportedActionTypes: ActionType[];
    supportedFormats?: ActionFormat[];
    supportedFormattings?: ("formatted" | "unformatted")[];
    supportedVisualizationFormattings?: ("apply" | "noapply")[];
    requiredFields?: IRequiredField[];
    params: IIntegrationParameter[];
    asJson(router: IRouteBuilder): {
        description: string;
        form_url: string | null;
        label: string;
        name: string;
        params: IIntegrationParameter[];
        required_fields: IRequiredField[] | undefined;
        supported_action_types: ActionType[];
        supported_formats: ActionFormat[] | undefined;
        supported_formattings: ("formatted" | "unformatted")[] | undefined;
        supported_visualization_formattings: ("apply" | "noapply")[] | undefined;
        icon_data_uri: any;
        url: string | null;
    };
    validateAndPerformAction(request: ActionRequest): Promise<ActionResponse>;
    validateAndFetchForm(request: ActionRequest): Promise<ActionForm>;
    readonly hasAction: boolean;
    readonly hasForm: boolean;
    private getImageDataUri();
}
