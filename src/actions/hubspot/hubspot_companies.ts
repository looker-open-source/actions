import * as Hub from "../../hub"
import { HubspotAction, HubspotCalls, HubspotTags } from "./hubspot"

export class HubspotCompaniesAction extends HubspotAction {
  requiredFields = [{ tag: HubspotTags.CompanyId, any_tag: this.allowedTags }]

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
