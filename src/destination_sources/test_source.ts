import { Destination } from "../destination";
import { DestinationSource } from "../destination_source";
import { DataActionResponse } from "../data_action_response";

export class TestDestinationSource extends DestinationSource {

  async sourcedDestinations() {
    let dest = new Destination();
    dest.id = "hotdest";
    dest.label = "Cool Zone Dotcom";
    dest.action = async function(request) {
      return new DataActionResponse();
    }
    return [dest];
  }

}
