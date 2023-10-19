import * as Hub from "../../hub";
import { RudderAction, RudderTags } from "./rudderstack";
export declare class RudderGroupAction extends RudderAction {
    tag: RudderTags;
    name: string;
    label: string;
    description: string;
    requiredFields: {
        tag: RudderTags;
        any_tag: RudderTags[];
    }[];
    minimumSupportedLookerVersion: string;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
}
