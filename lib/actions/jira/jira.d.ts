import * as Hub from "../../hub";
export declare class JiraAction extends Hub.Action {
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
    requiredFields: never[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    private jiraClientFromRequest;
}
