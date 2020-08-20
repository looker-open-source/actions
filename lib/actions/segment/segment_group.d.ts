import * as Hub from "../../hub";
import { SegmentAction, SegmentTags } from "./segment";
export declare class SegmentGroupAction extends SegmentAction {
    tag: SegmentTags;
    name: string;
    label: string;
    iconName: string;
    description: string;
    requiredFields: {
        tag: SegmentTags;
        any_tag: SegmentTags[];
    }[];
    minimumSupportedLookerVersion: string;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
}
