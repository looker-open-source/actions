import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { GoogleCloudStorageIntegration } from "./google_cloud_storage"

const integration = new GoogleCloudStorageIntegration()

function expectGoogleCloudStorageMatch(request: D.ActionRequest,
                                       bucketMatch: any,
                                       fileMatch: any,
                                       fileSaveMatch: any) {

  const fileSaveSpy = sinon.spy(() => Promise.resolve())
  const fileSpy = sinon.spy(() => ({save: fileSaveSpy}))
  const bucketSpy = sinon.spy(() => ({file: fileSpy}))

  const stubClient = sinon.stub(integration as any, "gcsClientFromRequest")
    .callsFake(() => ({
      bucket: bucketSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(bucketSpy).to.have.been.calledWithMatch(bucketMatch)
    chai.expect(fileSpy).to.have.been.calledWithMatch(fileMatch)
    chai.expect(fileSaveSpy).to.have.been.calledWithMatch(fileSaveMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no bucket", () => {
      const request = new D.DataActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need GCS bucket.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        bucket: "mybucket",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("sends right body to filename and bucket", () => {
      const request = new D.DataActionRequest()
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
      const request = new D.DataActionRequest()
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
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct buckets", (done) => {

      const stubClient = sinon.stub(integration as any, "gcsClientFromRequest")
        .callsFake(() => ({
          getBuckets: () => [[
            {metadata: {id: "1", name: "A"}},
            {metadata: {id: "2", name: "B"}},
          ]],
        }))

      const request = new D.DataActionRequest()
      const form = integration.validateAndFetchForm(request)
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
