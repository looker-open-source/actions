import * as Hub from "../../hub";
import { CustomerIoAction } from "./customerio";
export declare class CustomerIoTrackAction extends CustomerIoAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    minimumSupportedLookerVersion: string;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
}
