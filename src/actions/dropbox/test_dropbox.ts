import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { DropboxAction } from "./dropbox"

const action = new DropboxAction()

const stubFileName = "stubSuggestedFilename"
const stubDirectory = "stubSuggestedDirectory"

function expectDropboxMatch(request: Hub.ActionRequest, optionsMatch: any) {

  const fileUploadSpy = sinon.spy(async (_path: string, _contents: any) => Promise.resolve({}))

  const stubClient = sinon.stub(action as any, "dropboxClientFromRequest")
    .callsFake(() => ({
      filesUpload: fileUploadSpy,
    }))

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(fileUploadSpy).to.have.been.calledWithMatch(optionsMatch)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {
  describe("action", () => {

    it("returns an oauth form on bad login", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("Hello"), fileExtension: "csv"}
      request.formParams = {filename: stubFileName, directory: stubDirectory}
      return expectDropboxMatch(request,
        {path: `/${stubDirectory}/${stubFileName}.csv`, contents: Buffer.from("Hello")})
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("returns an oauth form on bad login", (done) => {
      const stubClient = sinon.stub(action as any, "dropboxClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.reject("haha I failed auth"),
        }))
      const request = new Hub.ActionRequest()
      request.params.state_json = "{\"access_token\":\"token123\"}"
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in with Dropbox",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", (done) => {
      const stubClient = sinon.stub(action as any, "dropboxClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.reject("haha I failed auth"),
        }))
      const request = new Hub.ActionRequest()
      request.params.state_json = "ABC123"
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in with Dropbox",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns correct fields on oauth success", (done) => {
      const stubClient = sinon.stub(action as any, "dropboxClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.resolve({entries: [{name: "fake_name", label: "fake_label"}]}),
        }))
      const request = new Hub.ActionRequest()
      request.params.state_json = "{\"access_token\":\"token123\"}"
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          description: "Dropbox directory where file will be saved",
          label: "Save in",
          name: "directory",
          options: [{ name: "fake_name", label: "fake_name" }],
          required: true,
          type: "select",
        }, {
          label: "Filename",
          name: "filename",
          type: "string",
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })
  })
})
