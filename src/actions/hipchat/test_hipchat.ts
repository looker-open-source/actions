import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { HipchatAction } from "./hipchat"

const action = new HipchatAction()

function expectHipchatMatch(request: Hub.ActionRequest, ...match: any[]) {

  const messageSpy = sinon.spy((room: any, message: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${room} ${message}`)
  })

  const stubClient = sinon.stub(action as any, "hipchatClientFromRequest")
    .callsFake(() => ({
      send_room_message: messageSpy,
    }))

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(messageSpy).to.have.been.calledWithMatch(...match)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no room", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
      }
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing room.")
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        room: "myroom",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right body and room", () => {
      const request = new Hub.ActionRequest()
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

    it("returns failure on hipchat send_room_message error", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        room: "myroom",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
      }
      const messageSpy = sinon.spy((_room: any, _message: any, callback: (err: any) => void) => {
        callback({
          type: "ROOM_NOT_FOUND",
          message: "Could not find room myroom",
        })
      })

      const stubClient = sinon.stub(action as any, "hipchatClientFromRequest")
        .callsFake(() => ({
          send_room_message: messageSpy,
        }))

      return chai.expect(action.execute(request)).to.eventually.deep.equal({
        success: false,
        message: "Could not find room myroom",
        refreshQuery: false,
        validationErrors: [],
      }).then(() => {
        stubClient.restore()
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct rooms", (done) => {
      const stubClient = sinon.stub(action as any, "hipchatClientFromRequest")
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

      const request = new Hub.ActionRequest()
      const form = action.validateAndFetchForm(request)
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
