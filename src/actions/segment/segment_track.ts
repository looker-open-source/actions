import * as Hub from "../../hub"
import { SegmentAction, SegmentCalls } from "./segment"

export class SegmentTrackAction extends SegmentAction {

  name = "segment_track"
  label = "Segment Track"
  iconName = "segment/segment.png"
  description = "Add traits via track to your Segment users."
  minimumSupportedLookerVersion = "5.5.0"

  async execute(request: Hub.ActionRequest) {
    return this.executeSegment(request, SegmentCalls.Track)
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
