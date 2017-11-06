import * as chai from "chai"

import * as D from "../../framework"

import { ZapierIntegration } from "./zapier"

const integration = new ZapierIntegration()

describe(`${integration.constructor.name} unit tests`, () => {

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with url param", (done) => {
      const request = new D.ActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Zapier Webhook URL",
          name: "url",
          required: true,
          type: "string",
        }],
      }).and.notify(done)
    })

  })

})
