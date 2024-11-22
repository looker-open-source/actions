import { ProcessQueue } from "../xpc/process_queue";
import { ActionDownloadSettings, ActionForm, ActionFormat, ActionFormatting, ActionRequest, ActionResponse, ActionType, ActionVisualizationFormatting } from ".";
export interface ActionParameter {
    name: string;
    label: string;
    required: boolean;
    sensitive: boolean;
    per_user?: boolean;
    description?: string;
}
export interface RequiredField {
    tag?: string;
    any_tag?: string[];
    all_tags?: string[];
}
export interface Action {
    execute(request: ActionRequest): Promise<ActionResponse>;
    form?(request: ActionRequest): Promise<ActionForm>;
}
export interface RouteBuilder {
    actionUrl(action: Action): string;
    formUrl(action: Action): string;
}
export declare abstract class Action {
    get hasForm(): boolean;
    abstract name: string;
    abstract label: string;
    abstract description: string;
    usesStreaming: boolean;
    executeInOwnProcess: boolean;
    extendedAction: boolean;
    iconName?: string;
    minimumSupportedLookerVersion: string;
    abstract supportedActionTypes: ActionType[];
    supportedFormats?: ((_request: ActionRequest) => ActionFormat[]) | ActionFormat[];
    supportedFormattings?: ActionFormatting[];
    supportedVisualizationFormattings?: ActionVisualizationFormatting[];
    supportedDownloadSettings?: string[];
    requiredFields?: RequiredField[];
    abstract params: ActionParameter[];
    asJson(router: RouteBuilder, request: ActionRequest): {
        description: string;
        form_url: string | null;
        label: string;
        name: string;
        params: ActionParameter[];
        required_fields: RequiredField[] | undefined;
        supported_action_types: ActionType[];
        uses_oauth: boolean;
        delegate_oauth: boolean;
        supported_formats: ActionFormat[] | undefined;
        supported_formattings: ActionFormatting[] | undefined;
        supported_visualization_formattings: ActionVisualizationFormatting[] | undefined;
        supported_download_settings: ActionDownloadSettings[];
        icon_data_uri: any;
        url: string;
    };
    validateAndExecute(request: ActionRequest, queue?: ProcessQueue): Promise<ActionResponse>;
    validateAndFetchForm(request: ActionRequest): Promise<ActionForm>;
    getImageDataUri(): any;
    private throwForMissingRequiredParameters;
}
