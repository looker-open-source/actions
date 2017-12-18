import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../../src/hub"

import { TwilioMessageAction } from "./twilio_message"

const action = new TwilioMessageAction()

function expectTwilioMatch(request: Hub.ActionRequest, match: any) {

  const createSpy = sinon.spy(async () => Promise.resolve())

  const stubClient = sinon.stub(action as any, "twilioClientFromRequest")
    .callsFake(() => ({
      messages: {create: createSpy},
    }))

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(createSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no phone tag", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.formParams = {
        message: "My Message",
      }

      request.attachment = {dataJSON: {
        fields: [{name: "coolfield"}],
        data: [
          {coolfield: {value: "12122222222"}},
        ],
      }}

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged phone.")
    })

    it("errors if the input has no message", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["phone"]}],
        data: [
          {coolfield: {value: "12122222222"}},
          {coolfield: {value: "12122222223"}},
        ],
      }}

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Need a message.")
    })

    it("sends right body", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        message: "My Message",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["phone"]}],
        data: [
          {coolfield: {value: "12122222222"}},
        ],
      }}
      return expectTwilioMatch(request, {
        to: "12122222222",
        body: request.formParams.message,
        from: "fromphone",
      })
    })

    it("errors if there is no attachment for cell", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        from: "fromphone",
      }
      request.formParams = {
        message: "My Message",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from cell.")
    })

    it("sends right params for cell", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        from: "fromphone",
        value: "12122222222",
      }
      request.formParams = {
        message: "My Message",
      }
      return expectTwilioMatch(request, {
        to: "12122222222",
        body: request.formParams.message,
        from: "fromphone",
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

  })

})
