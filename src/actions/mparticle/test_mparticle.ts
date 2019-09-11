import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import * as apiKey from "../../server/api_key"
import Server from "../../server/server"
import { MparticleAction } from "./mparticle"
import { USER } from "./mparticle_constants"

const action = new MparticleAction()

const sampleData = {
  fields: {
    measures: [],
    dimensions: [
      {name: "some.field", tags: ["sometag"]},
    ],
  },
  data: [{"some.field": {value: "value"}}],
}

describe(`${action.constructor.name} unit tests`, () => {
  describe("action", () => {

    it("errors if there is no apiKey", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        apiSecret: "myApiSecret",
      }
      request.formParams = {
        data_type: USER,
      }
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from(JSON.stringify(sampleData)),
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Required setting \"API Key\" not specified in action settings.")
    })

    it("errors if there is no apiSecret", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        apiKey: "myApiKey",
      }
      request.formParams = {
        data_type: USER,
      }
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from(JSON.stringify(sampleData)),
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Required setting \"API Secret\" not specified in action settings.")
    })

    it("errors if there is no data_type", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        apiKey: "myApiKey",
        apiSecret: "myApiSecret",
      }
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from(JSON.stringify(sampleData)),
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Missing data type (user|event).")
    })

    it("errors if there is not at least one userIdentity", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        apiKey: "myApiKey",
        apiSecret: "myApiSecret",
      }
      request.formParams = {
        data_type: USER,
      }
      request.attachment = {
        dataBuffer: Buffer.from(JSON.stringify(sampleData)),
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Each row must specify at least 1 identity tag.")
    })
  })

  describe("asJSON", () => {
    it("supported format is json_detail_lite_stream on lookerVersion 6.2 and above", (done) => {
      const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
      chai.request(new Server().app)
        .post("/actions/mparticle")
        .set("Authorization", "Token token=\"foo\"")
        .set("User-Agent", "LookerOutgoingWebhook/6.2.0")
        .end((_err, res) => {
          chai.expect(res).to.have.status(200)
          chai.expect(res.body).to.deep.include({supported_formats: ["json_detail_lite_stream"]})
          stub.restore()
          done()
        })
    })
  })
})
