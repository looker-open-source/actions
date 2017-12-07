import * as chai from "chai"
import * as req from "request-promise-native"
import * as sinon from "sinon"

import * as D from "../../framework"

import { WebhookAction } from "./webhook"

class GoodWebhookAction extends WebhookAction {

  constructor() {
    super()
    this.domain = "example.com"
  }

  async form() {
    const form = new D.ActionForm()
    form.fields = [{
      label: "Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}

const action = new GoodWebhookAction()

function expectWebhookMatch(request: D.ActionRequest, match: any) {
  const postSpy = sinon.spy(async () => null)
  const stubPost = sinon.stub(req, "post").callsFake(postSpy)
  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(postSpy).to.have.been.calledWith(match)
    stubPost.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new D.ActionRequest()
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json.")
    })

    it("errors if there is no url", () => {
      const request = new D.ActionRequest()
      request.formParams = {}
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing url.")
    })

    it("errors if there is wrong domain for url", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        url: "http://abc.com/",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Incorrect domain for url.")
    })

    it("sends right body", () => {
      const request = new D.ActionRequest()
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
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with url param", (done) => {
      const request = new D.ActionRequest()
      const form = action.validateAndFetchForm(request)
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
