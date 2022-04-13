import * as Hub from "../../hub";
import * as helpers from "@sendgrid/helpers";
export declare class SendGridAction extends Hub.Action {
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
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    sendEmail(request: Hub.ActionRequest, msg: helpers.classes.Mail): Promise<any>;
    form(): Promise<Hub.ActionForm>;
    private sgMailClientFromRequest;
}
