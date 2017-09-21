import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { WebhookIntegration } from "../../src/integrations/webhook"

const req: any = require("request")

const integration = new WebhookIntegration()

function expectWebhookMatch(request: D.DataActionRequest, match: any) {
  const postSpy = sinon.spy((params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${params}`)
  })
  const stubPost = sinon.stub(req, "post").callsFake(postSpy)
  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(postSpy).to.have.been.calledWith(match)
    stubPost.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("No attached json.")
    })

    it("errors if there is no url", () => {
      const request = new D.DataActionRequest()
      request.formParams = {}
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Missing url.")
    })

    it("sends right body", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        url: "webhookurl",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return expectWebhookMatch(request, {
        url: "webhookurl",
        body: request.attachment.dataJSON,
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with url param", () => {
      chai.expect(integration.form()).to.eventually.equal({
        fields: [{
          label: "Webhook URL",
          name: "url",
          required: true,
          type: "string",
        }],
      })
    })
  })
})
