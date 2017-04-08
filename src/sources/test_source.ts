import * as D from "../framework";

export class TestDestinationSource extends D.DestinationSource {

  async sourcedDestinations() {
    let dest = new D.Destination();
    dest.id = "hotdest";
    dest.label = "Cool Zone Dotcom";
    dest.action = async function(request) {
      return new D.DataActionResponse();
    }
    return [dest];
  }

}
