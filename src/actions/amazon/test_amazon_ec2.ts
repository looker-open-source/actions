import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { AmazonEC2Action } from "./amazon_ec2"

const action = new AmazonEC2Action()

function expectAmazonEC2Match(request: Hub.ActionRequest, match: any) {

  const stopInstancesSpy = sinon.spy((params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully called with ${params}`)
  })
  const stubClient = sinon.stub(action as any, "amazonEC2ClientFromRequest")
    .callsFake(() => ({
      stopInstances: stopInstancesSpy,
    }))
  const execute = action.execute(request)
  return chai.expect(execute).to.be.fulfilled.then(() => {
    chai.expect(stopInstancesSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no attachment for query", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for query", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["aws_resource_id"]}],
        data: [
          {coolfield: {value: "funvalue"}},
          {coolfield: {value: "funvalue1"}},
        ],
      }}
      return expectAmazonEC2Match(request, {InstanceIds: ["funvalue", "funvalue1"]})
    })

    it("errors if there is no attachment for cell", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from cell.")
    })

    it("sends right params for cell", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
        value: "funvalue",
      }
      return expectAmazonEC2Match(request, {InstanceIds: ["funvalue"]})
    })

  })

  describe("form", () => {

    it("doesn't have form", () => {
      chai.expect(action.hasForm).equals(false)
    })

  })

})
