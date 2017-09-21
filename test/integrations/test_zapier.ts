import * as chai from "chai"

import { ZapierIntegration } from "../../src/integrations/zapier"

const integration = new ZapierIntegration()

describe(`${integration.constructor.name} unit tests`, () => {

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with url param", () => {
      chai.expect(integration.form()).to.eventually.equal({
        fields: [{
          label: "Zapier Webhook URL",
          name: "url",
          required: true,
          type: "string",
        }],
      })
    })

  })

})
