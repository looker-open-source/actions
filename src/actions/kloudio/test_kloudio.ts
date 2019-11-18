import * as chai from "chai"
import * as Hub from "../../hub"

import { KloudioAction } from "./kloudio"

const action = new KloudioAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json.")
    })
  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with API and Gsheet param", (done) => {
      const request = new Hub.ActionRequest()
      request.params = { aws_access_key: "foo", aws_secret_key: "bar", aws_bucket: "buzz" }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "API Key",
          name: "apiKey",
          required: true,
          type: "string",
        }, {
          label: "Google Sheets URL",
          name: "url",
          required: true,
          type: "string",
        }],
      }).and.notify(done)
    })
  })
})
