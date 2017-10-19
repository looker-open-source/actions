import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { SFTPIntegration } from "../../src/integrations/sftp"

const integration = new SFTPIntegration()

function expectSFTPMatch(request: D.DataActionRequest, dataMatch: any, pathMatch: any) {

  const putSpy = sinon.spy(() => Promise.resolve())

  const stubClient = sinon.stub(integration as any, "sftpClientFromRequest")
    .callsFake(() => ({
      put: putSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => "stubSuggestedFilename")

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(putSpy).to.have.been.calledWithMatch(dataMatch, pathMatch)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no address", () => {
      const request = new D.DataActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Needs a valid SFTP address.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        address: "sftp://host/path/",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("sends right body to filename and address", () => {
      const request = new D.DataActionRequest()
      request.formParams = {
        address: "sftp://host/path/",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}
      return expectSFTPMatch(request,
        request.attachment.dataBuffer, "path/stubSuggestedFilename")
    })

    it("sends to right filename if specified", () => {
      const request = new D.DataActionRequest()
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
      chai.expect(integration.hasForm).equals(true)
    })

  })

})
