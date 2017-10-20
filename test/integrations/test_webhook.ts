import * as chai from "chai"
import * as req from "request-promise-native"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { WebhookIntegration } from "../../src/integrations/webhook"

class GoodWebhookIntegration extends WebhookIntegration {

  constructor() {
    super()
    this.domain = "example.com"
  }

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      label: "Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}

const integration = new GoodWebhookIntegration()

function expectWebhookMatch(request: D.DataActionRequest, match: any) {
  const postSpy = sinon.spy(async () => null)
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

    it("errors if there is wrong domain for url", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        url: "http://abc.com/",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Incorrect domain for url.")
    })

    it("sends right body", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        url: "http://abc.example.com/",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return expectWebhookMatch(request, {
        url: "http://abc.example.com/",
        form: request.attachment.dataJSON,
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with url param", (done) => {
      const request = new D.DataActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Webhook URL",
          name: "url",
          required: true,
          type: "string",
        }],
      }).and.notify(done)
    })
  })
})
