import * as Hub from "../../hub";
import { HubspotAction, HubspotCalls, HubspotTags } from "./hubspot";

export class HubspotCompanyAction extends HubspotAction {
  requiredFields = [{ tag: HubspotTags.CompanyId, any_tag: this.allowedTags }];

  constructor() {
    super({
      name: "hubspot_company",
      label: "Hubspot Company",
      description: "Update properties on your Hubspot companys.",
      call: HubspotCalls.Company,
      tag: HubspotTags.CompanyId,
    });
  }
}

Hub.addAction(new HubspotCompanyAction());
