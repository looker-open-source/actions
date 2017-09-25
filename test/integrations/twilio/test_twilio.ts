import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../../src/framework"

import { TwilioIntegration } from "../../../src/integrations/twilio/twilio"

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
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4\n5,6,7,8\n", "utf8")}

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need a destination phone number.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
      }
      request.formParams = {
        to: "tophone",
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
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4\n5,6,7,8\n", "utf8")}
      return expectTwilioMatch(request, {
        to: "tophone",
        body: "1,2,3,4\n5,6,7,8\n",
        from: "fromphone",
      })
    })

    it("sends right body with look title and url", () => {
      const request = new D.DataActionRequest()
      request.scheduledPlan = {
        title: "mylook",
        url: "http://my.looker.com/looks/12345",
      }
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        to: "tophone",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4\n5,6,7,8\n", "utf8")}
      return expectTwilioMatch(request, {
        to: "tophone",
        body: "mylook:\nhttp://my.looker.com/looks/12345\n1,2,3,4\n5,6,7,8\n",
        from: "fromphone",
      })
    })

    it("sends truncates body at 10 lines", () => {
      const request = new D.DataActionRequest()
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        to: "tophone",
      }
      request.attachment = {dataBuffer:
        Buffer.from((Array.from(new Array(10), (_, i) => i).join(",") + "\n").repeat(100), "utf8")}
      return expectTwilioMatch(request, {
        to: "tophone",
        body: (Array.from(new Array(10), (_, i) => i).join(",") + "\n").repeat(10),
        from: "fromphone",
      })
    })

    it("sends truncates body at 10 lines with title and url", () => {
      const request = new D.DataActionRequest()
      request.scheduledPlan = {
        title: "mylook",
        url: "http://my.looker.com/looks/12345",
      }
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        to: "tophone",
        title: "mylook",
      }
      request.attachment = {dataBuffer:
        Buffer.from((Array.from(new Array(10), (_, i) => i).join(",") + "\n").repeat(100), "utf8")}
      return expectTwilioMatch(request, {
        to: "tophone",
        body: "mylook:\n" +
          "http://my.looker.com/looks/12345\n" +
          (Array.from(new Array(10), (_, i) => i).join(",") + "\n").repeat(10),
        from: "fromphone",
      })
    })

    it("sends truncates body at 1600 with title on newline", () => {
      const request = new D.DataActionRequest()
      request.scheduledPlan = {
        title: "mylook",
        url: "http://my.looker.com/looks/12345",
      }
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        to: "tophone",
        title: "mylook",
      }
      request.attachment = {dataBuffer:
        Buffer.from((Array.from(new Array(100), (_, i) => i).join(",") + "\n").repeat(100), "utf8")}
      return expectTwilioMatch(request, {
        to: "tophone",
        body: "mylook:\n" +
          "http://my.looker.com/looks/12345\n" +
          (Array.from(new Array(100), (_, i) => i).join(",") + "\n").repeat(5),
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
