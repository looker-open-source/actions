import * as chai from "chai"
import chaiAsPromised = require("chai-as-promised")
import * as sinon from "sinon"
import * as Hub from "../../hub"
import { AzureStorageAction } from "./azure_storage"

chai.use(chaiAsPromised)

const action = new AzureStorageAction()

async function expectAzureStorageMatch(
  request: Hub.ActionRequest, _container: string, _fileName: string, dataBuffer: Buffer) {

  const uploadStreamSpy = sinon.spy(async (buffer: Buffer) => {
    chai.expect(buffer).to.deep.equal(dataBuffer)
  })

  const mockBlockBlobClient = {
    uploadStream: uploadStreamSpy,
  }

  const mockContainerClient = {
    getBlockBlobClient: sinon.stub().returns(mockBlockBlobClient),
  }

  const stubClient = sinon.stub(action as any, "azureClientFromRequest")
    .callsFake(() => ({
      getContainerClient: sinon.stub().withArgs(_container).returns(mockContainerClient),
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

    it("sends right body to filename and container", async () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        container: "mycontainer",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return await expectAzureStorageMatch(request,
        "mycontainer",
        "stubSuggestedFilename",
        Buffer.from("1,2,3,4", "utf8"))
    })

    it("sends to right filename if specified", async () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        container: "mycontainer",
        filename: "mywackyfilename",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return await expectAzureStorageMatch(request,
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
          listContainers: () => ({
            byPage: () => ({
              async *[Symbol.asyncIterator]() {
                yield {
                  containerItems: [
                    {id: "A", name: "A"},
                    {id: "B", name: "B"},
                  ],
                }
              },
            }),
          }),
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
          listContainers: () => ({
            byPage: () => ({
              async *[Symbol.asyncIterator]() {
                yield {
                  containerItems: [],
                }
              },
            }),
          }),
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
