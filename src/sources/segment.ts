import Segment = require("analytics-node");
import * as D from "../framework";

export class SegmentSource extends D.DestinationSource {

  public async sourcedDestinations() {

    let dest = new D.Destination();
    dest.name = "segment_event";
    dest.label = "Segment (Create Events)";
    dest.description = "Send data to Segment as events.";
    dest.params = [
      {
        description: "A write key for Segment.",
        label: "Segment Write Key",
        name: "segment_write_key",
        required: true,
      },
    ];
    dest.supportedActionTypes = ["query"];
    dest.supportedFormats = ["json"];
    dest.requiredFields = [{tag: "segment_user_id"}];

    dest.action = async (request) => {
      return new Promise<D.DataActionResponse>((resolve, reject) => {

        let segment = segmentClientFromRequest(request);

        if (!(request.attachment && request.attachment.dataJSON)) {
          reject("No attached json");
          return;
        }

        for (let row of request.attachment.dataJSON) {
          let keys = Object.keys(row);
          segment.identify({
            traits: row,
            userId: row[keys[0]],
          });
        }

        // TODO: does this batching have global state that could be a security problem
        segment.flush((err, _batch) => {
          if (err) {
            reject(err);
          } else {
            resolve(new D.DataActionResponse());
          }
        });

      });
    };

    return [dest];
  }

}

function segmentClientFromRequest(request: D.DataActionRequest) {
  return new Segment(request.params.segment_write_key);
}
