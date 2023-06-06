import * as Hub from "../../../hub";
export declare class SlackAttachmentAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    requiredFields: never[];
    params: {
        name: string;
        label: string;
        required: boolean;
        description: string;
        sensitive: boolean;
    }[];
    usesStreaming: boolean;
    executeInOwnProcess: boolean;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    private slackClientFromRequest;
}
