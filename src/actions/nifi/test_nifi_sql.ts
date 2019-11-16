import * as chai from "chai"

import * as Hub from "../../hub"

import { NifiSQLAction } from "./nifi_sql"

const action = new NifiSQLAction()

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
          name: "url",
          label: "HTTP endpoint to NiFi instance",
          description: "e.g. http://nifi/host/path:port",
          type: "string",
          required: true,
        }],
      }).and.notify(done)
    })

  })

})
