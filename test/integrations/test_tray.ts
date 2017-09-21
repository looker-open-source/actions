import * as chai from "chai"

import * as D from "../../src/framework"

import { TrayIntegration } from "../../src/integrations/tray"

const integration = new TrayIntegration()

describe(`${integration.constructor.name} unit tests`, () => {

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with url param", () => {
      const request = new D.DataActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.equal({
        fields: [{
          label: "Tray Webhook URL",
          name: "url",
          required: true,
          type: "string",
        }],
      })
    })

  })

})
