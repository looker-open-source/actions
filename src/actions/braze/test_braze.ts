import * as chai from "chai"
import * as req from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { BrazeAction } from "./braze"

const sampleBrazeData = {
  fields: {
    measures: [],
    dimensions: [
      {name: "external_id", tags: ["braze_id"]},
    ],
  },
  data: [{ external_id: {value: "abc123"}}, { external_id: {value: "xyz987"}}],
}

function expectBrazeMatch(request: Hub.ActionRequest) {
  const postSpy = sinon.spy(() => {
    return {success: true, message: "ok"}
  })
  const stubPost = sinon.stub(req, "post").callsFake(postSpy)
  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(postSpy).to.have.been.called
    stubPost.restore()
  })
}

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

    it("errors if is a not a Braze endpoint", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        braze_api_key: "AAACCCKKKATTT",
        braze_api_endpoint: "https://rest.notbraze.com",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing or Bad Endpoint.")
    })

    it("errors if is a not a valid endpoint", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        braze_api_key: "AAACCCKKKATTT",
        braze_api_endpoint: "rest.braze.com",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith( "Incorrect domain for endpoint.")
    })

    it("errors if missing API key", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        braze_api_key: "",
        braze_api_endpoint: "https://rest.braze.com",
      }
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing API Key.")
    })

    it("success with sample data", async () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        braze_api_key: "AAACCCKKKATTT",
        braze_api_endpoint: "https://rest.braze.com",
      }
      request.formParams = {
        braze_key: "external_id",
        braze_segment: "looker_export",
      }
      request.attachment = {
        dataBuffer: Buffer.from(JSON.stringify(sampleBrazeData)),
      }
      return expectBrazeMatch(request)
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })
})
