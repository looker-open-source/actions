"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HubspotContactsAction = void 0;
const Hub = require("../../hub");
const hubspot_1 = require("./hubspot");
class HubspotContactsAction extends hubspot_1.HubspotAction {
    constructor() {
        super({
            name: "hubspot_contacts",
            label: "Hubspot Contacts",
            description: "Update properties on your Hubspot contacts.",
            call: hubspot_1.HubspotCalls.Contact,
            tag: hubspot_1.HubspotTags.ContactId,
        });
    }
}
exports.HubspotContactsAction = HubspotContactsAction;
Hub.addAction(new HubspotContactsAction());
