import * as Hub from "../../hub";
import { WebhookAction } from "../webhook/webhook";
export declare class ZapierAction extends WebhookAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    domain: string;
    form(): Promise<Hub.ActionForm>;
}
