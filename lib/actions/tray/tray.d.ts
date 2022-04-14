import * as Hub from "../../hub";
import { WebhookAction } from "../webhook/webhook";
export declare class TrayAction extends WebhookAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    domain: string;
    form(): Promise<Hub.ActionForm>;
}
