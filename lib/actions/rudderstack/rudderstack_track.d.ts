import * as Hub from "../../hub";
import { RudderAction } from "./rudderstack";
export declare class RudderTrackAction extends RudderAction {
    name: string;
    label: string;
    description: string;
    minimumSupportedLookerVersion: string;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
}
