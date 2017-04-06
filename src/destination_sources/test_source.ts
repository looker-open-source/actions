import { Destination } from "../destination";
import { DestinationSource } from "../destination_source";

export class TestDestinationSource {

  sourcedDestinations() : Promise<Destination[]> {
    return new Promise((resolve, reject) => {

      let dest = new Destination();
      dest.id = "hotdest";
      dest.label = "Cool Zone Dotcom";

      resolve([dest]);
    });
  }

}
