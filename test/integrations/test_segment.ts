import * as chai from "chai"

import * as D from "../../src/framework"
import { SegmentIntegration } from "../../src/integrations/segment"

const integration = new SegmentIntegration()

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("No attached json")
    })

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(integration.hasForm).equals(false)
    })
  })

})
