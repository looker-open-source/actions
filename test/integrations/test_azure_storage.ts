import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { AzureStorageIntegration } from "../../src/integrations/azure_storage"

const integration = new AzureStorageIntegration()

function expectAzureStorageMatch(
  request: D.DataActionRequest, container: string, fileName: string, dataBuffer: Buffer) {

  const createBlockBlobFromTextSpy = sinon.spy(() => Promise.resolve())
  const stubClient = sinon.stub(integration as any, "azureClientFromRequest")
    .callsFake(() => ({
      createBlockBlobFromText: createBlockBlobFromTextSpy,
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
      const request = new D.DataActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Need Azure container.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        container: "mycontainer",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("sends right body to filename and container", () => {
      const request = new D.DataActionRequest()
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
      const request = new D.DataActionRequest()
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

  })

})
