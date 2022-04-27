import * as Hub from "../../hub";
export declare class TwilioMessageAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    requiredFields: {
        tag: string;
    }[];
    params: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
    private twilioClientFromRequest;
}
