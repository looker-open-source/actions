import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { GoogleCloudStorageIntegration } from "../../src/integrations/google_cloud_storage"

const integration = new GoogleCloudStorageIntegration()

function expectGoogleCloudStorageMatch(request: D.DataActionRequest, match_type: string, match: any) {

  const bucketSpy = sinon.spy()
  const fileSpy = sinon.spy()
  const fileSaveSpy = sinon.spy((buffer: any) => resolve())
  const stubClient = sinon.stub(integration as any, "gcsClientFromRequest")
    .callsFake(() => {
      return {
        bucket: bucketSpy,
        bucket.file: fileSpy,
        bucket.file.save: fileSaveSpy}
    })

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  const action = integration.action(request)
  let spy
  switch(match_type) {
    case "bucket": {
      spy = bucketSpy
      break
    }
    case "file": {
      spy = fileSpy
      break
    }
    case "save": {
      spy = fileSaveSpy
      break
    }
  }
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(spy).to.have.been.calledWithMatch(match)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no bucket", () => {
      const request = new D.DataActionRequest()
      request.params = {
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need Amazon S3 bucket.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("sends right body to key and bucket", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request, {
        Bucket: "mybucket",
        Key: "stubSuggestedFilename",
        Body: Buffer.from("1,2,3,4", "utf8"),
      })
    })

    it("sends to right filename if specified", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
        filename: "mywackyfilename",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request, {
        Bucket: "mybucket",
        Key: "mywackyfilename",
        Body: Buffer.from("1,2,3,4", "utf8"),
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

  })

})
