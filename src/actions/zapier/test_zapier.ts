import * as chai from "chai"

import * as Hub from "../../hub"

import { ZapierAction } from "./zapier"

const action = new ZapierAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with url param", (done) => {
      const request = new Hub.ActionRequest()
      const form = action.validateAndFetchForm(request)
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
