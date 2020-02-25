import * as chai from "chai"
import * as Hub from "../../hub"

process.env.KLOUDIO_SIGNED_URL = "https://api-test.kloud.io/v1/tools/signed-url-put-object?key="

import { KloudioAction } from "./kloudio"

const action = new KloudioAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json.")
    })

    it("errors if the input has incorrect Kloudio API Key", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        url: "https://docs.google.com/spreadsheets/d/1DE_4lllK3-7q/edit#gid=0",
        apiKey: "sampleAPIKey",
      }

      request.attachment = {dataJSON: {
        fields: {
          dimensions: [
            {name: "some.field", label: "some field"},
          ],
        },
        data: [{"some.field": {value: "value"}}],
      }}

      return chai.expect(action.execute(request))
        .to.be.fulfilled
        .then((result) => {
          chai.expect(result.success, "result.success").to.be.false
          chai.expect(result.message, "result.message").to.equal("UnAuthorized")
        })
    })

    it("errors if the input has invalid Gsheet URL", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        url: "https://www.sampleurl.com",
        apiKey: "sampleAPIKey",
      }

      request.attachment = {dataJSON: {
        fields: {
          dimensions: [
            {name: "some.field", label: "some field"},
          ],
        },
        data: [{"some.field": {value: "value"}}],
      }}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Invalid url")
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
