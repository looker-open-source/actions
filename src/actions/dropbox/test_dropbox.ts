import * as b64 from "base64-url"
import * as chai from "chai"
import * as https from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import {AwsKms} from "../../crypto/aws_kms"
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
  sinon.stub(AwsKms.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
  sinon.stub(AwsKms.prototype, "decrypt").callsFake( async (s: string) => s )

  describe("action", () => {

    it("successfully interprets execute request params", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("Hello"), fileExtension: "csv"}
      request.formParams = {filename: stubFileName, directory: stubDirectory}
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
      }
      return expectDropboxMatch(request,
        {path: `/${stubDirectory}/${stubFileName}.csv`, contents: Buffer.from("Hello")})
    })

    it("sets state to reset if error in fileUpload", (done) => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("Hello"), fileExtension: "csv"}
      request.formParams = {filename: stubFileName, directory: stubDirectory}
      request.type = Hub.ActionType.Query
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
      }
      const stubClient = sinon.stub(action as any, "dropboxClientFromRequest")
        .callsFake(() => ({
          filesUpload: async () => Promise.reject("reject"),
        }))
      const resp = action.validateAndExecute(request)
      chai.expect(resp).to.eventually.deep.equal({
        success: false,
        state: {data: "reset"},
        refreshQuery: false,
        validationErrors: [],
      }).and.notify(stubClient.restore).and.notify(done)
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
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in with Dropbox",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth?` +
            `state=eyJhcHAiOiJteWtleSIsInNlY3JldCI6Im15U2VjcmV0In0`,
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
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in with Dropbox",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth?` +
            `state=eyJhcHAiOiJteWtleSIsInNlY3JldCI6Im15U2VjcmV0In0`,
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
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
      }
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

  describe("oauth", () => {
    it("returns correct redirect url", () => {
      const prom = action.oauthUrl("https://actionhub.com/actions/dropbox/oauth_redirect",
        "https://somelooker.com/secret_state/token", `{"app":"looker","secret":"key"}`)
      return chai.expect(prom).to.eventually.equal("https://www.dropbox.com/oauth2/authorize?response_type=code&" +
        "client_id=looker&redirect_uri=https%3A%2F%2Factionhub.com%2Factions%2Fdropbox%2Foauth_redirect" +
        "&state=%7B%22lookerstateurl%22%3A%22https%3A%2F%2Fsomelooker.com%2Fsecret_state%2Ftoken%22%2C%22" +
        "creds%22%3A%22%7B%5C%22app%5C%22%3A%5C%22looker%5C%22%2C%5C%22secret%5C%22%3A%5C%22key%5C%22%7D%22%7D")
    })

    it("correctly handles redirect from authorization server", (done) => {
      const stubReq = sinon.stub(https, "post").callsFake(async () => Promise.resolve({access_token: "token"}))
      const stubGet = sinon.stub(https, "get").callsFake(async () => Promise.resolve({access_token: "token"}))
      const creds = `{\\"app\\":\\"looker\\",\\"secret\\":\\"key\\"}`
      const result = action.oauthFetchInfo({code: "code", state: `{"lookerstateurl":"lookerherenow.com",` +
          `"creds":"${creds}"}`}, "redirect")
      chai.expect(result).to.eventually.equal("<html><script>window.close()</script>></html>")
        .and.notify(stubReq.restore).and.notify(stubGet.restore).and.notify(done)
    })
  })
})
