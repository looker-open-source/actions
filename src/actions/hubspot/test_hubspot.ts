import * as chai from "chai";
import * as sinon from "sinon";

import * as Hub from "../../hub";
// import * as apiKey from "../../server/api_key";
// import Server from "../../server/server";
import { HubspotAction, HubspotCalls } from "./hubspot";
import { HubspotContactAction } from "./hubspot_contact";
import { HubspotCompanyAction } from "./hubspot_company";

const contactAction = new HubspotContactAction();
const companyAction = new HubspotCompanyAction();
contactAction.executeInOwnProcess = false;
companyAction.executeInOwnProcess = false;

function expectHubspotMatch(
  action: HubspotAction,
  request: Hub.ActionRequest,
  match: any
) {
  const BatchUpdateCallSpy = sinon.spy();
  let product: "contacts" | "companies" | "unknown" = "unknown";
  switch (action.call) {
    case HubspotCalls.Company:
      product = "companies";
      break;
    case HubspotCalls.Contact:
      product = "contacts";
      break;
    default:
      break;
  }

  // Ensure a supported hubspot CRM product is called
  if (product === "unknown") {
    chai.assert.fail(`No hubspot product supported`);
  }

  // Ensure Hubspot API was called successfully with the proper batch update payload
  const stubClient = sinon
    .stub(action as any, "hubspotClientFromRequest")
    .callsFake(() => {
      return {
        crm: {
          [product]: { batchApi: { update: BatchUpdateCallSpy } },
        },
      };
    });

  console.log("here tho: ", match);

  // Validate and Execute the request
  return chai
    .expect(action.validateAndExecute(request))
    .to.be.fulfilled.then(() => {
      chai.expect(BatchUpdateCallSpy).to.have.been.calledWithExactly(match);
      stubClient.restore();
    });
}

describe(`Hubspot Contact unit tests`, () => {
  describe("action", () => {
    it("works with hubspot_contact_id", () => {
      const request = new Hub.ActionRequest();
      request.type = Hub.ActionType.Query;
      request.params = {
        hubspot_api_key: "mykey",
      };
      request.attachment = {
        dataBuffer: Buffer.from(
          JSON.stringify({
            fields: {
              dimensions: [
                { name: "contact_id", tags: ["hubspot_contact_id"] },
                { name: "property_one" },
              ],
            },
            data: [
              {
                contact_id: { value: "0123456" },
                property_one: { value: "property_one_value_1" },
              },
              {
                contact_id: { value: "9876543" },
                property_one: { value: "property_one_value_2" },
              },
            ],
          })
        ),
      };
      return expectHubspotMatch(contactAction, request, [
        {
          id: "0123456",
          properties: { property_one: "property_one_value_1" },
        },
        {
          id: "9876543",
          properties: { property_one: "property_one_value_2" },
        },
      ]);
    });
  });
});
