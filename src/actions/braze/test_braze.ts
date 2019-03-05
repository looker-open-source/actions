import * as chai from "chai"
// import * as sinon from "sinon"
// import concatStream = require("concat-stream")
import * as Hub from "../../hub"

import { BrazeAction } from "./braze"

class BrazeActionTest extends BrazeAction {
  name = "braze"

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Unique Key",
      name: "braze_key",
      required: true,
      options: [
        {name: "external_id", label: "external_id"},
        {name: "user_alias", label: "user_alias"},
        {name: "braze_id", label: "braze_id"},
      ],
      type: "select",
      default: "external_id",
    }, {
      label: "Export Label",
      name: "braze_segment",
      required: true,
      type: "string",
    }]
    return form
  }
}

const action = new BrazeActionTest()

describe(`${action.constructor.name} unit tests`, () => {
  describe("action", () => {
    it("errors if there is no configuration for query", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing config settings.")
    })

    it("errors if is a not a braze endpoint", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        braze_api_token: "AAACCCKKKATTT",
        braze_api_endpoint: "https://rest.notbraze.com",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing or Bad Endpoint.")
    })

    it("errors if is a not a valid endpoint", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        braze_api_token: "AAACCCKKKATTT",
        braze_api_endpoint: "rest.braze.com",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith( "Incorrect domain for endpoint.")
    })

    it("errors if missing API key", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        braze_api_token: "",
        braze_api_endpoint: "https://rest.braze.com",
      }
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing API Key.")
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })
})
