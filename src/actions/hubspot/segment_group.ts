import * as Hub from "../../hub";
import { HubspotAction, HubspotCalls, HubspotTags } from "./segment";

export class SegmentGroupAction extends HubspotAction {
  tag = HubspotTags.SegmentGroupId;

  name = "segment_group";
  label = "Segment Group";
  iconName = "segment/segment.png";
  description = "Add traits and / or users to your Segment groups.";
  requiredFields = [{ tag: this.tag, any_tag: this.allowedTags }];
  minimumSupportedLookerVersion = "5.5.0";

  async execute(request: Hub.ActionRequest) {
    return this.executeHubspot(request, HubspotCalls.Group);
  }
}

Hub.addAction(new SegmentGroupAction());
