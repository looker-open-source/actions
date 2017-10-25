import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { DigitalOceanObjectStorageIntegration } from "./digitalocean_object_storage"

const integration = new DigitalOceanObjectStorageIntegration()

function expectAmazonS3Match(request: D.DataActionRequest, match: any) {

    const putObjectSpy = sinon.spy((params: any, callback: (err: any, data: any) => void) => {
      callback(null, `successfully put item ${params} in database`)
    })
    const stubClient = sinon.stub(integration as any, "amazonS3ClientFromRequest")
      .callsFake(() => ({
        putObject: putObjectSpy,
      }))
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

  /* "action" function is not functionally different from AmazonS3Integration */
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
          return expectAmazonS3Match(request, {
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
          return expectAmazonS3Match(request, {
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

    it("has form with correct buckets", (done) => {

      const stubClient = sinon.stub(integration as any, "amazonS3ClientFromRequest")
        .callsFake(() => ({
          listBuckets: (cb: (err: any, res: any) => void) => {
            const response = {
              Buckets: [
                {Name: "A"},
                {Name: "B"},
              ],
            }
            cb(null, response)
          },
        }))

      const request = new D.DataActionRequest()
      request.params = {access_key_id: "foo", secret_access_key: "bar", region: "nyc3"}
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Space Name",
          name: "bucket",
          required: true,
          options: [
            {name: "A", label: "A"},
            {name: "B", label: "B"},
          ],
          type: "select",
          default: "A",
        }, {
          label: "Path",
          name: "path",
          type: "string",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      }).and.notify(stubClient.restore).and.notify(done)

    })

  })

})
