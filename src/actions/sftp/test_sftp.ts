import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { SFTPAction } from "./sftp"

const action = new SFTPAction()

function expectSFTPMatch(request: Hub.ActionRequest, dataMatch: any, pathMatch: any) {

  const putSpy = sinon.spy(async () => Promise.resolve())

  const stubClient = sinon.stub(action as any, "sftpClientFromRequest")
    .callsFake(() => ({
      put: putSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(putSpy).to.have.been.calledWithMatch(dataMatch, pathMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no address", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Needs a valid SFTP address.")
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        address: "sftp://host/path/",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("errors with bad paths", async () => {
      const bumAddresses = [
        "sftp:/host/path/",
        "ftp://host/path/",
        "http://host/path/",
        "sftp/host/path/",
        "/host/path/",
      ]

      return Promise.all(bumAddresses.map((address) => {
        const request = new Hub.ActionRequest()
        request.formParams = {
          address,
        }
        return chai.expect(action.execute(request)).to.eventually.be.rejected
      }))
    })

    it("sends right body to filename and address", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        address: "sftp://host/path/",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectSFTPMatch(request,
        request.attachment.dataBuffer, "path/stubSuggestedFilename")
    })

    it("sends to right filename if specified", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        address: "sftp://host/path/",
        filename: "mywackyfilename",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectSFTPMatch(request,
        request.attachment.dataBuffer, "path/mywackyfilename")
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

  })

})
