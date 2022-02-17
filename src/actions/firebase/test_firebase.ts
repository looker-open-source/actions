import * as chai from "chai"
// import * as sinon from "sinon"

import * as Hub from "../../hub"

import { FirebaseAction } from "./firebase"

const action = new FirebaseAction()
// const stubFilename = "stubSuggestedFilename"

// function expectFirebaseMatch(request: Hub.ActionRequest, match: any) {
//
//   const sendSpy = sinon.spy(async () => Promise.resolve())
//
//   const stubClient = sinon.stub(action as any, "sendMessageToDevice")
//     .callsFake(() => ({
//       send: sendSpy,
//     }))
//
//   const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
//     .callsFake(() => stubFilename)
//
//   return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
//     chai.expect(sendSpy).to.have.been.calledWithMatch(match)
//     stubClient.restore()
//     stubSuggestedFilename.restore()
//   })
// }

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {
    it("errors if there is no notification data", () => {
      const response = new Hub.ActionResponse({success: false, message: "Need valid notification data."})
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
        .deep.equal(response)
    })

    it("errors if there is no alertId.", () => {
      const response = new Hub.ActionResponse({success: false, message: "Need Valid AlertId."})
      const request = new Hub.ActionRequest()
      let dashboardData = {"dashboardId": "123"}
      request.formParams = {title: "title", "data": JSON.stringify(dashboardData)}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
        .deep.equal(response)
    })

    it("no errors if there is valid request", () => {
      const response = new Hub.ActionResponse({success: true})
      const request = new Hub.ActionRequest()
      request.formParams = {title: "title", "data": {"alertId": "123"}}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")
      return chai.expect(action.execute(request)).to.eventually
        .deep.equal(response)
    })
  })
})