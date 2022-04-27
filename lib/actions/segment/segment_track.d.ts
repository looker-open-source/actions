import * as Hub from "../../hub";
import { SegmentAction } from "./segment";
export declare class SegmentTrackAction extends SegmentAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    minimumSupportedLookerVersion: string;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(): Promise<Hub.ActionForm>;
}
