import { Destination } from "../destination";
import { DestinationSource } from "../destination_source";
import { DataActionResponse } from "../data_action_response";

export class TestDestinationSource {

  sourcedDestinations() : Promise<Destination[]> {
    return new Promise((resolve, reject) => {

      let dest = new Destination();
      dest.id = "hotdest";
      dest.label = "Cool Zone Dotcom";
      dest.action = function(request) {
        return Promise.resolve(new DataActionResponse());
      }

      resolve([dest]);
    });
  }

}
