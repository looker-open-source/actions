import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { FirebaseAction } from "./firebase"

const action = new FirebaseAction()

// function expectFirebaseMatch(request: Hub.ActionRequest, uploadImageMatch: any, sendMessageMatch: any) {
//
//   const sendSpyUploadImage = sinon.spy(async () => {
//     Promise.resolve("image")
//     })
//   const sendSpySendMessage = sinon.spy(async () => Promise.resolve())
//
//   const stubClientUploadImage = sinon.stub(action as any, "uploadImage")
//     .callsFake(() => ({
//       uploadImage: sendSpyUploadImage,
//     }))
//
//   const stubClientSendMessage = sinon.stub(action as any, "verifyAndSendMessage")
//     .callsFake(() => ({
//       verifyAndSendMessage: sendSpySendMessage,
//     }))
//
//   return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
//     chai.expect(sendSpyUploadImage).to.have.been.calledWithMatch(uploadImageMatch)
//     chai.expect(sendSpySendMessage).to.have.been.calledWithMatch(sendMessageMatch)
//     stubClientUploadImage.restore()
//     stubClientSendMessage.restore()
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
      const alertIdData = {"alertId": "123"}
      request.formParams = {title: "title", data: alertIdData as any}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")
//       return expectFirebaseMatch(request, {request: request}, {params: request.formParams, image: "image"})
      return chai.expect(action.execute(request)).to.eventually
        .deep.equal(response)
    })
  })
})