import * as b64 from "base64-url"
import * as chai from "chai"
import * as https from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import {ActionCrypto} from "../../hub"
import { DropboxAction } from "./dropbox"

const action = new DropboxAction()

const stubFileName = "stubSuggestedFilename"
const stubDirectory = "stubSuggestedDirectory"

async function expectDropboxMatch(sandbox: sinon.SinonSandbox, request: Hub.ActionRequest, optionsMatch: any): Promise<any> {

  const fileUploadSpy = sandbox.spy(async (_path: string, _contents: any) => Promise.resolve({}))

  sandbox.stub(action as any, "dropboxClientFromRequest")
    .callsFake(() => ({
      filesUpload: fileUploadSpy,
    }))

  await action.execute(request)
  sinon.assert.calledWithMatch(fileUploadSpy, optionsMatch)
}

describe(`${action.constructor.name} unit tests`, () => {
  let sandbox: sinon.SinonSandbox

  beforeEach(() => {
    sandbox = sinon.createSandbox()
    sandbox.stub(ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    sandbox.stub(ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe("action", () => {

    it("has streaming disabled to support legacy schedules", () => {
      chai.expect(action.usesStreaming).equals(false)
    })

    it("successfully interprets execute request params", async () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("Hello"), fileExtension: "csv"}
      request.formParams = {filename: stubFileName, directory: stubDirectory}
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      await expectDropboxMatch(sandbox, request,
        {path: `/${stubDirectory}/${stubFileName}.csv`, contents: Buffer.from("Hello")})
    })

    it("sets state to reset if error in fileUpload", async () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("Hello"), fileExtension: "csv"}
      request.formParams = {filename: stubFileName, directory: stubDirectory}
      request.type = Hub.ActionType.Query
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      sandbox.stub(action as any, "dropboxClientFromRequest")
        .callsFake(() => ({
          filesUpload: async () => Promise.reject("reject"),
        }))
      const resp = await action.validateAndExecute(request)
      chai.expect(resp).to.deep.equal({
        success: false,
        state: {data: "reset"},
        refreshQuery: false,
        validationErrors: [],
      })
    })
    it("uses oauthExtractTokensFromStateJson to decrypt state", async () => {
      const stubDecrypt = sandbox.stub(action as any, "oauthExtractTokensFromStateJson").resolves({access_token: "decrypted_token"})
      const request = new Hub.ActionRequest()
      request.params = { state_json: "encrypted_json" }
      request.attachment = {dataBuffer: Buffer.from("Hello"), fileExtension: "csv"}
      request.formParams = {filename: stubFileName, directory: stubDirectory}

      await expectDropboxMatch(sandbox, request, {path: `/${stubDirectory}/${stubFileName}.csv`, contents: Buffer.from("Hello")})

      sinon.assert.calledWith(stubDecrypt, "encrypted_json", request.webhookId)
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("returns an oauth form on bad login", async () => {
      sandbox.stub(action as any, "dropboxClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.reject("haha I failed auth"),
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      const form = await action.validateAndFetchForm(request)
      chai.expect(form).to.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          description: "In order to send to a Dropbox file or folder now and in the future, you will need to log " +
            "in once to your Dropbox account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
          `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      })
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", async () => {
      sandbox.stub(action as any, "dropboxClientFromRequest")
        .callsFake(() => ({
          filesListFolder: async (_: any) => Promise.reject("haha I failed auth"),
        }))
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: `{"access_token": "token"}`,
      }
      const form = await action.validateAndFetchForm(request)
      chai.expect(form).to.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          description: "In order to send to a Dropbox file or folder now and in the future, you will need to log " +
            "in once to your Dropbox account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/dropbox/oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      })
    })

    it("returns correct fields on oauth success", async () => {
      sandbox.stub(action as any, "dropboxClientFromRequest")
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
      const form = await action.validateAndFetchForm(request)
      chai.expect(form).to.deep.equal({
        fields: [{
          default: "__root",
          description: "Dropbox folder where your file will be saved",
          label: "Select folder to save file",
          name: "directory",
          options: [{ name: "__root", label: "Home" }, { name: "fake_name", label: "fake_name" }],
          required: true,
          type: "select",
        }, {
          label: "Enter a name",
          name: "filename",
          type: "string",
          required: true,
        }, {
          label: "Append timestamp",
          name: "includeTimestamp",
          description: "Append timestamp to end of file name. Should be set to 'Yes' if the file will be sent repeatedly",
          required: true,
          default: "no",
          type: "select",
          options: [{
            name: "yes",
            label: "Yes",
          }, {
            name: "no",
            label: "No",
          }],
        }],
      })
    })
  })

  describe("oauth", () => {
    it("returns correct redirect url", async () => {
      process.env.DROPBOX_ACTION_APP_KEY = "testingkey"
      const prom = await action.oauthUrl("https://actionhub.com/actions/dropbox/oauth_redirect",
        `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`)
      chai.expect(prom).to.equal("https://www.dropbox.com/oauth2/authorize?response_type=code&" +
        "client_id=testingkey&redirect_uri=https%3A%2F%2Factionhub.com%2Factions%2Fdropbox%2Foauth_redirect&" +
        "force_reapprove=true&" +
        "state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0")
    })

    it("correctly handles redirect from authorization server", async () => {
      // @ts-ignore
      sandbox.stub(https, "post").callsFake(async () => Promise.resolve({access_token: "token"}))
      await action.oauthFetchInfo({code: "code",
        state: `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZh` +
          `c2RmIiwiYXBwIjoibXlrZXkifQ`},
        "redirect")
    })
    it("uses oauthMaybeEncryptTokens to secure payload", async () => {
      const stubEncrypt = sandbox.stub(action as any, "oauthMaybeEncryptTokens").resolves("encrypted_state")
      // @ts-ignore
      const stubPost = sandbox.stub(https, "post").resolves({})

      await action.oauthFetchInfo({code: "code", state: `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZh` +
        `c2RmIiwiYXBwIjoibXlrZXkifQ`}, "redirect")

      sinon.assert.calledWithMatch(stubEncrypt, {code: "code", redirect: "redirect"})
      sinon.assert.calledWithMatch(stubPost, {body: "encrypted_state"})
    })
  })

  describe("dropboxFilename", () => {
    it("returns basic filename if includeTimeStamp flag is not set", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {filename: stubFileName, directory: stubDirectory}
      const result = action.dropboxFilename(request)
      chai.expect(result).equal(stubFileName)
    })

    it("returns basic filename if includeTimeStamp flag is no", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {filename: stubFileName, directory: stubDirectory, includeTimestamp: "no"}
      const result = action.dropboxFilename(request)
      chai.expect(result).equal(stubFileName)
    })

    it("returns filename with timestamp if includeTimeStamp flag is yes", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {filename: stubFileName, directory: stubDirectory, includeTimestamp: "yes"}
      const result = action.dropboxFilename(request)
      chai.expect(result).to.include(stubFileName)
      chai.expect(result).not.equal(stubFileName)
    })
  })
})
