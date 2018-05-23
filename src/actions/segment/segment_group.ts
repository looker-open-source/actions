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
    let response: { message?: string, success?: boolean } = { success: true }
    const errors = await this.processSegment(request, SegmentCalls.Group)
    if (errors) {
      response = {
        success: false,
        message: errors.map((e) => e.message).join(", "),
      }
    }
    return new Hub.ActionResponse(response)
  }

}

Hub.addAction(new SegmentGroupAction())
