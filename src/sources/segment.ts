import * as D from "../framework";

let Segment = require("analytics-node");

export class SegmentSource extends D.DestinationSource {

  async sourcedDestinations() {

    let dest = new D.Destination();
    dest.name = "segment_event";
    dest.label = "Create Segment Events";
    dest.description = "Send data to Segment as events.";
    dest.params = [
      {
        name: "segment_write_key",
        label: "Segment Write Key",
        required: true,
        description: "A write key for Segment."
      }
    ];
    dest.supportedActionTypes = ["query"];
    dest.supportedFormats = ["json"];
    dest.requiredFields = [{tag: "segment_user_id"}];

    dest.action = async function(request) {
      let segment = segmentClientFromRequest(request);

      return new D.DataActionResponse();
    }

    return [dest];
  }

}

function segmentClientFromRequest(request : D.DataActionRequest) {
  return new Segment(request.params["segment_write_key"]);
}
