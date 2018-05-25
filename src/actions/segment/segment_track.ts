import * as Hub from "../../hub"
import { SegmentAction, SegmentCalls } from "./segment"

export class SegmentTrackAction extends SegmentAction {

  name = "segment_track"
  label = "Segment Track"
  iconName = "segment/segment.png"
  description = "Add traits via track to your Segment users."
  minimumSupportedLookerVersion = "5.5.0"

  async execute(request: Hub.ActionRequest) {
    let response: { message?: string, success?: boolean } = { success: true }
    const errors = await this.processSegment(request, SegmentCalls.Track)
    if (errors) {
      response = {
        success: false,
        message: errors.map((e) => e.message).join(", "),
      }
    }
    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      name: "event",
      label: "Event",
      description: "The name of the event you’re tracking.",
      type: "string",
      required: true,
    }]
    return form
  }

}

Hub.addAction(new SegmentTrackAction())
