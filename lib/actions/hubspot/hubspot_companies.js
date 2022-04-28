"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubspotCompaniesAction = void 0;
const Hub = require("../../hub");
const hubspot_1 = require("./hubspot");
class HubspotCompaniesAction extends hubspot_1.HubspotAction {
    constructor() {
        super({
            name: "hubspot_companies",
            label: "Hubspot Companies",
            description: "Update properties on your Hubspot companies.",
            call: hubspot_1.HubspotCalls.Company,
            tag: hubspot_1.HubspotTags.CompanyId,
        });
    }
}
exports.HubspotCompaniesAction = HubspotCompaniesAction;
Hub.addAction(new HubspotCompaniesAction());
