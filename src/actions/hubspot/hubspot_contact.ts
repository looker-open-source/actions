import * as Hub from "../../hub";
import { HubspotAction, HubspotCalls, HubspotTags } from "./hubspot";

export class HubspotContactAction extends HubspotAction {
  requiredFields = [{ tag: HubspotTags.ContactId, any_tag: this.allowedTags }];

  constructor() {
    super({
      name: "hubspot_contact",
      label: "Hubspot Contact",
      description: "Update properties on your Hubspot contact.",
      call: HubspotCalls.Contact,
      tag: HubspotTags.ContactId,
    });
  }
}

Hub.addAction(new HubspotContactAction());
