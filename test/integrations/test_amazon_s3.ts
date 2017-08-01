import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

// const AWS = require("aws-sdk")

import { AmazonS3Integration } from "../../src/integrations/amazon_s3"

const integration = new AmazonS3Integration()

function expectAmazonS3Match(request: D.DataActionRequest, match: any) {

  const putObjectSpy = sinon.spy((params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully put item ${params} in database`)
  })
  const stubClient = sinon.stub(integration as any, "amazonS3ClientFromRequest")
    .callsFake(() => {
      return {putObject: putObjectSpy}
    })
  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(putObjectSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no access key", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need Amazon S3 access key, secret_key, bucket, region.")
    })

    it("errors if there is no secret key", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
        access_key_id: "mykey",
        region: "us-east-1",
      }
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need Amazon S3 access key, secret_key, bucket, region.")
    })

    it("errors if there is no bucket", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        access_key_id: "mykey",
        secret_access_key: "mysecret",
        region: "us-east-1",
      }
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need Amazon S3 access key, secret_key, bucket, region.")
    })

    it("errors if there is no region", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
        access_key_id: "mykey",
        secret_access_key: "mysecret",
      }
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need Amazon S3 access key, secret_key, bucket, region.")
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
      return expectAmazonS3Match(request, {
        Bucket: "mybucket",
        Key: "stubSuggestedFilename",
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
