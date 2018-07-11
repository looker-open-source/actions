import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../../hub"
import { GoogleAdsPauseAction } from "./google_ads_pause"

const action = new GoogleAdsPauseAction()

function expectGoogleAdsPauseMatch(request: Hub.ActionRequest, match: any) {
  const pauseSpy = sinon.spy()
  const stubClient = sinon.stub(action as any, "googleAdsClientFromRequest")
    .callsFake(() => {
      // TODO update stubbed call
      return {pause: pauseSpy}
     })

  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(pauseSpy).to.have.been.calledWithExactly(match)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("works with google_ads:criteria_id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        secret: "secret",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
          fields: {dimensions: [{name: "creative_id", tags: ["google_ads:creative_id"]}]},
          data: [{creative_id: {value: "my_fun_creative_id"}}],
        }))}
      return expectGoogleAdsPauseMatch(request, {
        creative_id: "my_fun_creative_id",
      })
    })

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(action.hasForm).equals(false)
    })
  })

})
