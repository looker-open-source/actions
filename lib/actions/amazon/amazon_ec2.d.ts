import * as Hub from "../../hub";
export declare class AmazonEC2Action extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    params: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    requiredFields: {
        tag: string;
    }[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    private amazonEC2ClientFromRequest;
}
