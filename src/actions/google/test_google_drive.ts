import * as b64 from "base64-url"
import * as chai from "chai"
import * as https from "request-promise-native"
import * as sinon from "sinon"
const streamifier: any = require("streamifier")

import * as Hub from "../../hub"

import {ActionCrypto} from "../../hub"
import { GoogleDriveAction } from "./google_drive"

const action = new GoogleDriveAction()

const stubFileName = "stubSuggestedFilename"
const stubFolder = "looker"

function expectGoogleDriveMatch(request: Hub.ActionRequest, optionsMatch: any) {

  const fileUploadSpy = sinon.spy(async (_path: string, _contents: any) => Promise.resolve({}))

  const stubClient = sinon.stub(action as any, "getClientFromRequest")
    .callsFake(() => ({
      files: {
        create: fileUploadSpy,
      },
    }))

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(fileUploadSpy).to.have.been.calledWithMatch(optionsMatch)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {
  let encryptStub: any
  let decryptStub: any

  before(() => {
    encryptStub = sinon.stub(ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    decryptStub = sinon.stub(ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  after(() => {
    encryptStub.restore()
    decryptStub.restore()
  })

  describe("action", () => {

    it("successfully interprets execute request params", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {
        dataBuffer: Buffer.from("Hello"),
        fileExtension: "csv",
        mime: "application/json",
        encoding: "utf8",
      }
      request.formParams = {filename: stubFileName, folder: stubFolder}
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
        stateUrl: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        stateJson: `{"access_token": "token"}`,
      }
      return expectGoogleDriveMatch(request,
        {
          media: {
            body: streamifier.createReadStream(Buffer.from("Hello")),
          },
          resource: {
            mimeType: "application/json",
            name: "stubSuggestedFilename",
            parents: ["looker"],
          },
        })
    })

    it("sets state to reset if error in fileUpload", (done) => {
      const request = new Hub.ActionRequest()
      request.attachment = {
        dataBuffer: Buffer.from("Hello"),
        fileExtension: "csv",
        mime: "application/json",
        encoding: "utf8",
      }
      request.formParams = {filename: stubFileName, folder: stubFolder}
      request.type = Hub.ActionType.Query
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      const stubClient = sinon.stub(action as any, "getClientFromRequest")
        .callsFake(() => ({
          files: {create: async () => Promise.reject("reject") },
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
      const stubClient = sinon.stub(action as any, "getClientFromRequest")
        .callsFake(() => ({
          files: {create: async (_: any) => Promise.reject("haha I failed auth") },
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in with Google",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_drive/oauth?state=` +
          "eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9" +
          "va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0",
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", (done) => {
      const stubClient = sinon.stub(action as any, "getClientFromRequest")
        .callsFake(() => ({
          files: {create: async (_: any) => Promise.reject("haha I failed auth") },
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in with Google",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_drive/oauth?` +
            "state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9" +
            "va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0",
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns correct fields on oauth success", (done) => {
      const stubClient = sinon.stub(action as any, "getClientFromRequest")
        .callsFake(() => ({
          files: { create: async (_: any) => Promise.resolve({entries: [{
              "name": "fake_name",
              "label": "fake_label",
              ".tag": "folder"}],
          }),
        }}))
      const request = new Hub.ActionRequest()
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Log in with Google",
          name: "login",
          oauth_url: "undefined/actions/google_drive/oauth?state=e30",
          type: "oauth_link",
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })
  })

  describe("oauth", () => {
    it("returns correct redirect url", () => {
      process.env.GOOGLE_DRIVE_CLIENT_ID = "testingkey"
      const prom = action.oauthUrl("https://actionhub.com/actions/google_drive/oauth_redirect",
        `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`)
      return chai.expect(prom).to.eventually.equal("https://accounts.google.com/o/oauth2/v2/auth?" +
        "access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&state=eyJzdGF0ZXV" +
        "ybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0" +
        "&response_type=code&client_id=&redirect_uri=https%3A%2F%2Factionhub.com%2Factions%2Fgoogle_drive" +
        "%2Foauth_redirect",
      )
    })

    it("correctly handles redirect from authorization server", (done) => {
      const stubReq = sinon.stub(https, "post").callsFake(async () => Promise.resolve({access_token: "token"}))
      const result = action.oauthFetchInfo({code: "code",
        state: `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZh` +
          `c2RmIiwiYXBwIjoibXlrZXkifQ`},
        "redirect")
      chai.expect(result)
        .and.notify(stubReq.restore).and.notify(done)
    })
  })
})
