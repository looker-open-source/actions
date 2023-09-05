import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { FirebaseAction } from "./firebase"

const action = new FirebaseAction()

function expectFirebaseMatch(request: Hub.ActionRequest, sendMessageMatch: any) {
  const spySendMessage = sinon.spy(async () => Promise.resolve())

  const stubClientSendMessage = sinon.stub(action as any, "verifyAndSendMessage")
    .callsFake(spySendMessage)

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(stubClientSendMessage).to.have.been.calledWithMatch(sendMessageMatch)
    stubClientSendMessage.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {
    it("errors if there is no notification data", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
              .be.rejectedWith("Need valid notification data.")
    })

    it("errors if there is no alertId.", () => {
      const request = new Hub.ActionRequest()
      const dashboardData = {dashboard_id: "123"}
      request.formParams = {title: "title", data: JSON.stringify(dashboardData)}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
                    .be.rejectedWith("Need Valid AlertId.")
    })

    it("errors if there is no valid title.", () => {
      const request = new Hub.ActionRequest()
      const alertIdData = {alert_id: "123"}
      request.formParams = {data: alertIdData as any}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Needs a valid title.")
    })

    it("no errors if there is valid request", () => {
      const response = new Hub.ActionResponse({success: true})
      const request = new Hub.ActionRequest()
      const alertIdData = {alert_id: "123"}
      request.formParams = {title: "title", data: alertIdData as any}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
        .deep.equal(response)
    })

    it("no errors if there is valid deviceId's", () => {
      const request = new Hub.ActionRequest()
      const alertIdData = {alert_id: "123"}
      const deviceIdData = {deviceIds: [{userId: "1", deviceId: "1"}, {userId: "1", deviceId: "1"}]}
      request.formParams = {title: "title", data: alertIdData as any, deviceIds: deviceIdData as any}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return expectFirebaseMatch(request, request.formParams)
    })

    it("Check right methods being called", () => {
      const request = new Hub.ActionRequest()
      const alertIdData = {alert_id: "123"}
      request.formParams = {title: "title", data: alertIdData as any}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")
      return expectFirebaseMatch(request, request.formParams)
    })
  })
})
