import * as Hub from "../../hub";
export declare class AzureStorageAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    usesStreaming: boolean;
    requiredFields: never[];
    params: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    private azureClientFromRequest;
}
