import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
// import * as apiKey from "../../server/api_key";
// import Server from "../../server/server";
import { HubspotAction, HubspotCalls } from "./hubspot"

export const expectHubspotMatch = (
  action: HubspotAction,
  request: Hub.ActionRequest,
  match: any
) => {
  const BatchUpdateCallSpy = sinon.spy()
  let product: "contacts" | "companies" | "unknown" = "unknown"
  switch (action.call) {
    case HubspotCalls.Company:
      product = "companies"
      break
    case HubspotCalls.Contact:
      product = "contacts"
      break
    default:
      break
  }

  // Ensure a supported hubspot CRM product is called
  if (product === "unknown") {
    chai.assert.fail(`No hubspot product supported`)
  }

  // Ensure Hubspot API was called successfully with the proper batch update payload
  const stubClient = sinon
    .stub(action as any, "hubspotClientFromRequest")
    .callsFake(() => {
      return {
        crm: {
          [product]: { batchApi: { update: BatchUpdateCallSpy } },
        },
      }
    })

  // Validate and Execute the request
  return chai
    .expect(action.validateAndExecute(request))
    .to.be.fulfilled.then(() => {
      chai.expect(BatchUpdateCallSpy).to.have.been.calledWithExactly(match)
      stubClient.restore()
    })
}
