import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { AzureStorageAction } from "./azure_storage"

const action = new AzureStorageAction()

function expectAzureStorageMatch(
  request: Hub.ActionRequest, container: string, fileName: string, dataBuffer: Buffer) {

  const createBlockBlobFromTextSpy = sinon.spy((c: string, f: string, b: Buffer, cb: (err: any, res: any) => void) => {
    chai.expect(c).to.not.equal(null)
    chai.expect(f).to.not.equal(null)
    chai.expect(b).to.not.equal(null)
    cb(null, null)
  })

  const stubClient = sinon.stub(action as any, "azureClientFromRequest")
    .callsFake(() => ({
      createBlockBlobFromText: createBlockBlobFromTextSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(createBlockBlobFromTextSpy).to.have.been.calledWithMatch(container, fileName, dataBuffer)
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

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        container: "mycontainer",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
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

})
