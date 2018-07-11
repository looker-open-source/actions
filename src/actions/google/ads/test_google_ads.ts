import * as chai from "chai"

import * as Hub from "../../../hub"
import { GoogleAdsAction } from "./google_ads"

class NoopGoogleAdsAction extends GoogleAdsAction {

  description = "Noop Google Ads."
  label = "Noop"
  name = "Noop"

  async execute() {
    return new Hub.ActionResponse()
  }
}

const action = new NoopGoogleAdsAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    // TODO update required params
    it("errors if there is no secret", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["google_ads:creative_id"]}]},
        data: [],
      }))}
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(`Required parameter "secret" not provided.`)
    })

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(action.hasForm).equals(false)
    })
  })

})
