import * as Hub from "../../hub"
import { SegmentAction, SegmentCalls, SegmentTags } from "./segment"

export class SegmentGroupAction extends SegmentAction {

  tag = SegmentTags.SegmentGroupId

  name = "segment_group"
  label = "Segment Group"
  iconName = "segment/segment.png"
  description = "Add traits and / or users to your Segment groups."
  requiredFields = [{ tag: this.tag , any_tag: this.allowedTags}]
  minimumSupportedLookerVersion = "5.5.0"

  async execute(request: Hub.ActionRequest) {
    try {
      await this.processSegment(request, SegmentCalls.Group)
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

}

Hub.addAction(new SegmentGroupAction())
