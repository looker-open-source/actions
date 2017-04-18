import * as D from "../framework";

let Segment = require("analytics-node");

export class SegmentSource extends D.DestinationSource {

  async sourcedDestinations() {

    let dest = new D.Destination();
    dest.name = "segment_event";
    dest.label = "Segment (Create Events)";
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
      return new Promise<D.DataActionResponse>((resolve, reject) => {

        let segment = segmentClientFromRequest(request);

        if (!(request.attachment && request.attachment.dataJSON)) {
          reject("No attached json");
          return;
        }

        for (let row of request.attachment.dataJSON) {
          let keys = Object.keys(row);
          segment.identify({
            userId: row[keys[0]],
            traits: row
          });
        }

        // TODO: does this batching have global state that could be a security problem
        segment.flush((err, batch) => {
          if (err) {
            reject(err);
          } else {
            resolve(new D.DataActionResponse());
          }
        });

      });
    }

    return [dest];
  }

}

function segmentClientFromRequest(request : D.DataActionRequest) {
  return new Segment(request.params["segment_write_key"]);
}
