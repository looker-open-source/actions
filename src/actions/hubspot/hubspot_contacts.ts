import * as Hub from "../../hub"
import { HubspotAction, HubspotCalls, HubspotTags } from "./hubspot"

export class HubspotContactsAction extends HubspotAction {
  constructor() {
    super({
      name: "hubspot_contacts",
      label: "Hubspot Contacts",
      description: "Update properties on your Hubspot contacts.",
      call: HubspotCalls.Contact,
      tag: HubspotTags.ContactId,
    })
  }
}

Hub.addAction(new HubspotContactsAction())
