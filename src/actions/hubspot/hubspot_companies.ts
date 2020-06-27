import * as Hub from "../../hub"
import { HubspotAction, HubspotCalls, HubspotTags } from "./hubspot"

export class HubspotCompaniesAction extends HubspotAction {
  constructor() {
    super({
      name: "hubspot_companies",
      label: "Hubspot Companies",
      description: "Update properties on your Hubspot companies.",
      call: HubspotCalls.Company,
      tag: HubspotTags.CompanyId,
    })
  }
}

Hub.addAction(new HubspotCompaniesAction())
