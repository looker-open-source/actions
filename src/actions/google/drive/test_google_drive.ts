import * as b64 from "base64-url"
import * as chai from "chai"
import * as https from "request-promise-native"
import * as sinon from "sinon"

import concatStream = require("concat-stream")

import * as Hub from "../../../hub"

import { ActionCrypto } from "../../../hub"
import { GoogleDriveAction } from "./google_drive"

const action = new GoogleDriveAction()

const stubFileName = "stubSuggestedFilename"
const stubFolder = "stubSuggestedFolder"

function expectGoogleDriveMatch(request: Hub.ActionRequest, paramsMatch: any) {

  const expectedBuffer = paramsMatch.media.body
  delete paramsMatch.media.body

  const createSpy = sinon.spy(async (params: any) => {
    params.media.body.pipe(concatStream((buffer) => {
      chai.expect(buffer.toString()).to.equal(expectedBuffer.toString())
    }))
    return { promise: async () => Promise.resolve() }
  })

  const stubClient = sinon.stub(action as any, "driveClientFromRequest")
    .resolves({
      files: {
        create: createSpy,
      },
    })

  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(createSpy).to.have.been.called
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {
  let encryptStub: any
  let decryptStub: any

  beforeEach(() => {
    encryptStub = sinon.stub(ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    decryptStub = sinon.stub(ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  afterEach(() => {
    encryptStub.restore()
    decryptStub.restore()
  })

  describe("action", () => {

    it("successfully interprets execute request params", () => {
      const request = new Hub.ActionRequest()
      const dataBuffer = Buffer.from("Hello")
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer, fileExtension: "csv"}
      request.formParams = {filename: stubFileName, folder: stubFolder}
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "access", redirect: "url"}),
      }
      return expectGoogleDriveMatch(request, {
        requestBody: {
          name: stubFileName,
          mimeType: undefined,
          parents: [stubFolder],
        },
        media: {
          body: dataBuffer,
        },
      })
    })

    it("sets state to reset if error in create", (done) => {
      const request = new Hub.ActionRequest()
      const dataBuffer = Buffer.from("Hello")
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer, fileExtension: "csv"}
      request.formParams = {filename: stubFileName, folder: stubFolder}
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "code", redirect: "url"}),
      }
      request.webhookId = "webhookId"
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
        .resolves({
          files: {
            create: async () => Promise.reject("reject"),
          },
        })
      const resp = action.validateAndExecute(request)
      chai.expect(resp).to.eventually.deep.equal({
        success: false,
        message: undefined,
        refreshQuery: false,
        validationErrors: [],
        error: {
          documentation_url: "TODO",
          http_code: 500,
          location: "ActionContainer",
          message: "Internal server error. [GOOGLE_DRIVE] undefined",
          status_code: "INTERNAL",
        },
        webhookId: "webhookId",
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("sets state to reset if error in create contains code and reason", (done) => {
      const request = new Hub.ActionRequest()
      const dataBuffer = Buffer.from("Hello")
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer, fileExtension: "csv"}
      request.formParams = {filename: stubFileName, folder: stubFolder}
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "code", redirect: "url"}),
      }
      request.webhookId = "webhookId"
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
          .resolves({
            files: {
              create: async () => Promise.reject({
                code: 1234,
                errors: [
                  {
                    message: "testReason",
                  },
                ],
              }),
            },
          })
      const resp = action.validateAndExecute(request)
      chai.expect(resp).to.eventually.deep.equal({
        success: false,
        message: undefined,
        refreshQuery: false,
        validationErrors: [],
        error: {
          documentation_url: "TODO",
          http_code: 1234,
          location: "ActionContainer",
          message: "Internal server error. [GOOGLE_DRIVE] testReason",
          status_code: "INTERNAL",
        },
        webhookId: "webhookId",
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("filename missing in request", () => {
      const request = new TestActionRequest()
      request.webhookId = "webhookId"
      const resp = action.validateAndExecute(request)
      chai.expect(resp).to.eventually
          .deep.equal({
        message: "Server cannot process request due to client request error. Error creating filename from request",
        refreshQuery: false,
        success: false,
        error: {
          http_code: 400,
          status_code: "BAD_REQUEST",
          message: "Server cannot process request due to client request error. [GOOGLE_DRIVE] Error creating filename from request",
          location: "ActionContainer",
          documentation_url: "TODO",
        },
        webhookId: "webhookId",
      })
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("returns an oauth form on bad login", (done) => {
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
        .resolves({
          files: {
            list: async () => Promise.reject("reject"),
          },
        })
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "access", redirect: "url"}),
      }
      request.webhookId = "testId"
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link_google",
          description: "In order to send to Google Drive, you will need to log in" +
            " once to your Google account. WebhookID if oauth fails: testId",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_drive/` +
            `oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", (done) => {
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
        .resolves({
          files: {
            list: async () => Promise.reject("reject"),
          },
        })
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({bad: "access", redirect: "url"}),
      }
      request.webhookId = "testId"
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link_google",
          description: "In order to send to Google Drive, you will need to log in" +
          " once to your Google account. WebhookID if oauth fails: testId",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_drive/` +
            `oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns correct fields on oauth success", (done) => {
      const stubClient = sinon.stub(action as any, "driveClientFromRequest")
        .resolves({
          files: {
            list: async () => Promise.resolve({
              data: {
                files: [
                  {
                    id: "fake_id",
                    name: "fake_name",
                  },
                ],
              },
            }),
          },
          drives: {
            list: async () => Promise.resolve({
              data: {
                drives: [
                  {
                    id: "fake_drive",
                    name: "fake_drive_label",
                  },
                ],
              },
            }),
          },
        })
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "access", redirect: "url"}),
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          description: "Google Drive where your file will be saved",
          label: "Select Drive to save file",
          name: "drive",
          options: [{name: "mydrive", label: "My Drive"}, {name: "fake_drive", label: "fake_drive_label"}],
          default: "mydrive",
          interactive: true,
          required: true,
          type: "select",
        }, {
          description: "Enter the full Google Drive URL of the folder where you want to save your data. It should look something like https://drive.google.com/corp/drive/folders/xyz. If this is inaccessible, your data will be saved to the root folder of your Google Drive. You do not need to enter a URL if you have already chosen a folder in the dropdown menu.\n",
          label: "Google Drive Destination URL",
          name: "folderid",
          type: "string",
          required: false,
        }, {
          description: "Fetch folders",
          name: "fetchpls",
          type: "select",
          interactive: true,
          label: "Select Fetch to fetch a list of folders in this drive",
          options: [{label: "Fetch", name: "fetch"}],
        }, {
          label: "Enter a filename",
          name: "filename",
          type: "string",
          required: true,
        }],
        state: {
          data: JSON.stringify({tokens: "access", redirect: "url"}),
        },
      }).and.notify(stubClient.restore).and.notify(done)
    })
  })

  describe("oauth", () => {
    it("returns correct redirect url", () => {
      process.env.GOOGLE_DRIVE_CLIENT_ID = "testingkey"
      const prom = action.oauthUrl("https://actionhub.com/actions/google_drive/oauth_redirect",
        `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`)
      return chai.expect(prom).to.eventually.equal("https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email&prompt=consent&state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0&response_type=code&client_id=testingkey&redirect_uri=https%3A%2F%2Factionhub.com%2Factions%2Fgoogle_drive%2Foauth_redirect")
    })

    it("correctly handles redirect from authorization server", (done) => {
      const stubAccessToken = sinon.stub(action as any, "getAccessTokenCredentialsFromCode").resolves({tokens: "token"})
      // @ts-ignore
      const stubReq = sinon.stub(https, "post").callsFake(async () => Promise.resolve({access_token: "token"}))
      const result = action.oauthHandleRedirect({code: "code",
        state: `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZh` +
          `c2RmIiwiYXBwIjoibXlrZXkifQ`},
        "redirect")
      chai.expect(result)
        .and.notify(stubAccessToken.restore)
        .and.notify(stubReq.restore).and.notify(done)
    })
  })

  describe("mimeType", () => {
    it("identifies attachment mimeTypes", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {mime: "application/zip;base64"}
      request.formParams = {format: "foobar"}
      chai.expect(action.getMimeType(request)).to.equal("application/zip;base64")
      request.attachment = {mime: "application/pdf;base64"}
      chai.expect(action.getMimeType(request)).to.equal("application/pdf;base64")
      request.attachment = {mime: "image/png;base64"}
      chai.expect(action.getMimeType(request)).to.equal("image/png;base64")
    })

    it("identifies mimeType for streamed actions", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {format: "csv"}
      chai.expect(action.getMimeType(request)).to.equal("text/csv")
      request.formParams = {format: "json"}
      chai.expect(action.getMimeType(request)).to.equal("application/json")
    })

    it("returns undefined if no format is given", () => {
      const request = new Hub.ActionRequest()
      chai.expect(action.getMimeType(request)).to.equal(undefined)
    })
  })
})

class TestActionRequest extends Hub.ActionRequest {
  suggestedFileName() {
    return null
  }
}
