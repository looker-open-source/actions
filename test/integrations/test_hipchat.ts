import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { HipchatIntegration } from "../../src/integrations/hipchat"

const integration = new HipchatIntegration()

function expectHipchatMatch(request: D.DataActionRequest, match: any) {

  const messageSpy = sinon.spy((params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${params}`)
  })

  const stubClient = sinon.stub(integration as any, "hipchatClientFromRequest")
    .callsFake(() => ({
      rooms: {
        message: messageSpy,
        list: (filters: any, callback: (err: any, response: any) => void) => {
          callback(null, {
            ok: true,
            rooms: [
              {id: "1", name: "A"},
              {id: "2", name: "B"},
            ],
            filters,
          })
        },
      },
    }))

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(messageSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no room", () => {
      const request = new D.DataActionRequest()
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
      }
      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Missing room.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        room: "myroom",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right body and room", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        room: "myroom",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
      }
      return expectHipchatMatch(request, {
        room_id: request.formParams.room,
        from: "Looker",
        message: request.suggestedTruncatedMessage(10, 10000),
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct rooms", () => {
      const request = new D.DataActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.equal({
        fields: [{
          description: "Name of the Slack room you would like to post to.",
          label: "Share In",
          name: "room",
          options: [
            {id: "1", label: "A"},
            {id: "2", label: "B"},
          ],
          required: true,
          type: "select",
        }, {
          label: "Comment",
          type: "string",
          name: "initial_comment",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      })
    })

  })

})
