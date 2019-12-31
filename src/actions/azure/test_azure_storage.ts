import * as chai from "chai"
import * as sinon from "sinon"
import { Stream } from "stream"

import * as Hub from "../../hub"

import { AzureStorageAction } from "./azure_storage"

const action = new AzureStorageAction()

function expectAzureStorageMatch(
  request: Hub.ActionRequest, _container: string, _fileName: string, dataBuffer: Buffer) {

  const createWriteStreamToBlockBlobSpy = sinon.spy(async () => {
    let data = Buffer.from("")
    const stream = new Stream()
    stream
      .on("data", (chunk: any) => {
        data = Buffer.concat([data, chunk])
      })
      .on("finish", () => {
        chai.expect(data).to.equal(dataBuffer)
      })
    return stream
  })

  const stubClient = sinon.stub(action as any, "azureClientFromRequest")
    .callsFake(() => ({
      createWriteStreamToBlockBlob: createWriteStreamToBlockBlobSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no container", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Need Azure container.")
    })

    it("sends right body to filename and container", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        container: "mycontainer",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectAzureStorageMatch(request,
        "mycontainer",
        "stubSuggestedFilename",
        Buffer.from("1,2,3,4", "utf8"))
    })

    it("sends to right filename if specified", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        container: "mycontainer",
        filename: "mywackyfilename",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectAzureStorageMatch(request,
        "mycontainer",
        "mywackyfilename",
        Buffer.from("1,2,3,4", "utf8"))
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with correct containers", (done) => {
      const stubClient = sinon.stub(action as any, "azureClientFromRequest")
        .callsFake(() => ({
          listContainersSegmented: (filter: any, cb: (err: any, res: any) => void) => {
            chai.expect(filter).to.equal(null)
            const containers = {
              entries: [
                {id: "A", name: "A"},
                {id: "B", name: "B"},
              ],
            }
            cb(null, containers)
          },
        }))

      const request = new Hub.ActionRequest()
      request.params = {
        account: "foo",
        accessKey: "foo",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Container",
          name: "container",
          required: true,
          options: [
            {name: "A", label: "A"},
            {name: "B", label: "B"},
          ],
          type: "select",
          default: "A",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

  })

  it("returns form error if no containers are present", (done) => {
    const stubClient = sinon.stub(action as any, "azureClientFromRequest")
        .callsFake(() => ({
          listContainersSegmented: (filter: any, cb: (err: any, res: any) => void) => {
            chai.expect(filter).to.equal(null)
            const containers = {
              entries: [],
            }
            cb(null, containers)
          },
        }))

    const request = new Hub.ActionRequest()
    request.params = {
      account: "foo",
      accessKey: "foo",
    }
    const form = action.validateAndFetchForm(request)
    chai.expect(form).to.eventually.deep.equal({
      error: "Create a container in your Azure account.",
      fields: [],
    }).and.notify(stubClient.restore).and.notify(done)
  })

})
