import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { TwilioIntegration } from "../../src/integrations/twilio"

const integration = new TwilioIntegration()

function expectTwilioMatch(request: D.DataActionRequest, match: any) {

  const createSpy = sinon.spy(() => Promise.resolve())

  const stubClient = sinon.stub(integration as any, "twilioClientFromRequest")
    .callsFake(() => ({
      messages: {create: createSpy},
    }))

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(createSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no to", () => {
      const request = new D.DataActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need a destination phone number.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("sends right body", () => {
      const request = new D.DataActionRequest()
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        to: "tophone",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectTwilioMatch(request, {
        to: "tophone",
        body: Buffer.from("1,2,3,4", "utf8").toString("utf8"),
        from: "fromphone",
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

  })

})
