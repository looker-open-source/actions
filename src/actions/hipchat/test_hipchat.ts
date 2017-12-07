import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { HipchatAction } from "./hipchat"

const integration = new HipchatAction()

function expectHipchatMatch(request: D.ActionRequest, ...match: any[]) {

  const messageSpy = sinon.spy((room: any, message: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${room} ${message}`)
  })

  const stubClient = sinon.stub(integration as any, "hipchatClientFromRequest")
    .callsFake(() => ({
      send_room_message: messageSpy,
    }))

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(messageSpy).to.have.been.calledWithMatch(...match)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no room", () => {
      const request = new D.ActionRequest()
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
      }
      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Missing room.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        room: "myroom",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right body and room", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        room: "myroom",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
      }
      return expectHipchatMatch(request,
        request.formParams.room, {
          from: "Looker",
          message: request.suggestedTruncatedMessage(10, 10000),
        })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct rooms", (done) => {
      const stubClient = sinon.stub(integration as any, "hipchatClientFromRequest")
      .callsFake(() => ({
        rooms: (callback: (err: any, response: any) => void) => {
            callback(null, [
              {id: "1", name: "A", privacy: "public", is_archived: false},
              {id: "2", name: "B", privacy: "public", is_archived: false},
              {id: "3", name: "C", privacy: "private", is_archived: false},
              {id: "4", name: "D", privacy: "public", is_archived: true},
            ])
          },
      }))

      const request = new D.ActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          description: "Name of the Hipchat room you would like to post to.",
          label: "Share In",
          name: "room",
          options: [
            {name: "1", label: "A"},
            {name: "2", label: "B"},
          ],
          required: true,
          type: "select",
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

  })

})
