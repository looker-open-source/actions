import * as chai from "chai"
import * as sinon from "sinon"
import { Readable } from "stream"

import * as Hub from "../../hub"

import { GoogleCloudStorageAction } from "./google_cloud_storage"

import concatStream = require("concat-stream")

const action = new GoogleCloudStorageAction()

function expectGoogleCloudStorageMatch(request: Hub.ActionRequest,
                                       bucketMatch: any,
                                       fileMatch: any,
                                       fileSaveMatch: Buffer) {

  const fileSaveSpy = sinon.spy((upload: Readable, callback: (err: any, data: any) => void) => {
    upload.pipe(concatStream((buffer) => {
      chai.expect(buffer).to.equal(fileSaveMatch)
    }))
    callback(null, `great success`)
  })
  const fileSpy = sinon.spy(() => ({save: fileSaveSpy}))
  const bucketSpy = sinon.spy(() => ({file: fileSpy}))

  const stubClient = sinon.stub(action as any, "gcsClientFromRequest")
    .callsFake(() => ({
      bucket: bucketSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(bucketSpy).to.have.been.calledWithMatch(bucketMatch)
    chai.expect(fileSpy).to.have.been.calledWithMatch(fileMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no bucket", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Need Google Cloud Storage bucket.")
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
      }

      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(
          "A streaming action was sent incompatible data. The action must have a download url or an attachment.")
    })

    it("sends right body to filename and bucket", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "stubSuggestedFilename",
        Buffer.from("1,2,3,4", "utf8"))
    })

    it("sends to right filename if specified", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Dashboard
      request.params = {
        client_email: "myemail",
        private_key: "mykey",
        project_id: "myproject",
      }
      request.formParams = {
        bucket: "mybucket",
        filename: "mywackyfilename",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectGoogleCloudStorageMatch(request,
        "mybucket",
        "mywackyfilename",
        Buffer.from("1,2,3,4", "utf8"))
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct buckets", (done) => {

      const stubClient = sinon.stub(action as any, "gcsClientFromRequest")
        .callsFake(() => ({
          getBuckets: () => [[
            {id: "1", name: "A"},
            {id: "2", name: "B"},
          ]],
        }))

      const request = new Hub.ActionRequest()
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Bucket",
          name: "bucket",
          required: true,
          options: [
            {name: "1", label: "A"},
            {name: "2", label: "B"},
          ],
          type: "select",
          default: "1",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

  })

})
