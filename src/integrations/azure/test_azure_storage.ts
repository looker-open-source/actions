import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { AzureStorageIntegration } from "./azure_storage"

const integration = new AzureStorageIntegration()

function expectAzureStorageMatch(
  request: D.ActionRequest, container: string, fileName: string, dataBuffer: Buffer) {

  const createBlockBlobFromTextSpy = sinon.spy((c: string, f: string, b: Buffer, cb: (err: any, res: any) => void) => {
    chai.expect(c).to.not.equal(null)
    chai.expect(f).to.not.equal(null)
    chai.expect(b).to.not.equal(null)
    cb(null, null)
  })

  const stubClient = sinon.stub(integration as any, "azureClientFromRequest")
    .callsFake(() => ({
      createBlockBlobFromText: createBlockBlobFromTextSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(createBlockBlobFromTextSpy).to.have.been.calledWithMatch(container, fileName, dataBuffer)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no container", () => {
      const request = new D.ActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need Azure container.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        container: "mycontainer",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("sends right body to filename and container", () => {
      const request = new D.ActionRequest()
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
      const request = new D.ActionRequest()
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
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct containers", (done) => {
      const stubClient = sinon.stub(integration as any, "azureClientFromRequest")
        .callsFake(() => ({
          listContainersSegmented: (filter: any, cb: (err: any, res: any) => void) => {
            chai.expect(filter).to.equal(null)
            const containers = {
              entries: [
                {id: "1", name: "A"},
                {id: "2", name: "B"},
              ],
            }
            cb(null, containers)
          },
        }))

      const request = new D.ActionRequest()
      const form = integration.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Container",
          name: "container",
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
