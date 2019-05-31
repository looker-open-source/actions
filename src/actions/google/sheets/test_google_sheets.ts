import * as b64 from "base64-url"
import * as chai from "chai"
import * as https from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../../hub"

import { ActionCrypto } from "../../../hub"
import { GoogleSheetsAction } from "./google_sheets"

const action = new GoogleSheetsAction()

const stubFileName = "stubSuggestedFilename"
const stubDirectory = "stubSuggestedDirectory"

function expectGoogleSheetsMatch(request: Hub.ActionRequest, paramsMatch: any) {

  const createSpy = sinon.spy(async (_params: any) => Promise.resolve({}))

  const stubClient = sinon.stub(action as any, "driveClientFromRequest")
    .callsFake(() => ({
      create: createSpy,
    }))

  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(createSpy).to.have.been.calledWithMatch(paramsMatch)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {
  sinon.stub(ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
  sinon.stub(ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )

  describe("action", () => {

    it("successfully interprets execute request params", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("Hello"), fileExtension: "csv"}
      request.formParams = {filename: stubFileName, directory: stubDirectory}
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
        stateUrl: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        stateJson: `{"access_token": "token"}`,
      }
      return expectGoogleSheetsMatch(request,
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
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
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
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.reject("haha I failed auth"),
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
          description: "In order to send to Google Drive, you will need to log in" +
            " once to your Google account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_sheets/` +
            `oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", (done) => {
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.reject("haha I failed auth"),
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
          description: "In order to send to Google Drive, you will need to log in" +
          " once to your Google account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_sheets/` +
            `oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns correct fields on oauth success", (done) => {
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.resolve({entries: [{
              "name": "fake_name",
              "label": "fake_label",
              ".tag": "folder"}],
          }),
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        appKey: "mykey",
        secretKey: "mySecret",
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          default: "__root",
          description: "Google Drive folder where file will be saved",
          label: "Select folder to save file",
          name: "directory",
          options: [{ name: "fake_name", label: "fake_name" }],
          required: true,
          type: "select",
        }, {
          label: "Enter a name",
          name: "filename",
          type: "string",
          required: true,
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })
  })

  describe("oauth", () => {
    it("returns correct redirect url", () => {
      process.env.GOOGLE_SHEETS_CLIENT_ID = "testingkey"
      const prom = action.oauthUrl("https://actionhub.com/actions/google_sheets/oauth_redirect",
        `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`)
      return chai.expect(prom).to.eventually.equal("https://www.dropbox.com/oauth2/authorize?response_type=code&" +
        "client_id=testingkey&redirect_uri=https%3A%2F%2Factionhub.com%2Factions%google_sheets%2Foauth_redirect&" +
        "force_reapprove=true&" +
        "state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0")
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
