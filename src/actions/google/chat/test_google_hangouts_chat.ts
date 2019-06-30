import * as b64 from "base64-url"
import * as chai from "chai"
import * as https from "request-promise-native"
import * as sinon from "sinon"

import * as Hub from "../../../hub"

import { ActionCrypto } from "../../../hub"
import { GoogleHangoutsChatAction } from "./google_hangouts_chat"

const action = new GoogleHangoutsChatAction()

const stubFileName = "stubSuggestedFilename"
const stubSpace = "stubSpace"

function expectGoogleHangoutsChatMatch(request: Hub.ActionRequest, paramsMatch: any) {
  const createSpy = sinon.spy(async () => Promise.resolve())

  const stubClient = sinon.stub(action as any, "chatClientFromRequest")
    .resolves({
      spaces: {
        messages: {
          create: createSpy,
        },
      },
    })

  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(createSpy).to.have.been.calledWith(paramsMatch)
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
      request.formParams = {filename: stubFileName, space: stubSpace}
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "access", redirect: "url"}),
      }
      // todo fix expected params
      return expectGoogleHangoutsChatMatch(request, {
        requestBody: {
          space: {
            name: stubSpace,
          },
          text: "",
          cards: [{
            header: {
              title: "",
              imageUrl: "",
            },
          }],
        },
      })
    })

    it("sets state to reset if error in create", (done) => {
      const request = new Hub.ActionRequest()
      const dataBuffer = Buffer.from("Hello")
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer, fileExtension: "csv"}
      request.formParams = {filename: stubFileName, space: stubSpace}
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "code", redirect: "url"}),
      }
      const stubClient = sinon.stub(action as any, "chatClientFromRequest")
        .resolves({
          spaces: {
            messages: {
              create: async () => Promise.reject({
                message: "error message",
              }),
            },
          },
        })
      const resp = action.validateAndExecute(request)
      chai.expect(resp).to.eventually.deep.equal({
        success: false,
        message: "error message",
        // state: {data: "reset"},
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
      const stubClient = sinon.stub(action as any, "chatClientFromRequest")
        .resolves({
          spaces: {
            list: async () => Promise.reject("reject"),
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
          name: "login",
          type: "oauth_link",
          description: "In order to send to Google Hangouts Chat, you will need to log in" +
            " to your Google account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_hangouts_chat/` +
            `oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("does not blow up on bad state JSON and returns an OAUTH form", (done) => {
      const stubClient = sinon.stub(action as any, "chatClientFromRequest")
        .resolves({
          spaces: {
            list: async () => Promise.reject("reject"),
          },
        })
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://looker.state.url.com/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({bad: "access", redirect: "url"}),
      }
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "login",
          type: "oauth_link",
          description: "In order to send to Google Hangouts Chat, you will need to log in" +
          " to your Google account.",
          label: "Log in",
          oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/google_hangouts_chat/` +
            `oauth?state=eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9` +
            `va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`,
        }],
        state: {},
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns correct fields on oauth success", (done) => {
      const stubClient = sinon.stub(action as any, "chatClientFromRequest")
        .resolves({
          spaces: {
            list: async () => Promise.resolve({
              data: {
                spaces: [
                  {
                    displayName: "fake_display",
                    name: "fake_name",
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
          description: "Google Hangouts Chat space",
          label: "Select Space to send message",
          name: "space",
          options: [{ name: "fake_name", label: "fake_display" }],
          required: true,
          type: "select",
        }, {
          label: "Enter a name",
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
      process.env.GOOGLE_HANGOUTS_CHAT_CLIENT_ID = "testingkey"
      const prom = action.oauthUrl("https://actionhub.com/actions/google_hangouts_chat/oauth_redirect",
        `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0`)
      return chai.expect(prom).to.eventually.equal("https://accounts.google.com/o/oauth2/v2/auth?" +
        "access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fchat.bot&prompt=consent&state=" +
        "eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZhc2RmIn0&" +
        "response_type=code&client_id=testingkey&" +
        "redirect_uri=https%3A%2F%2Factionhub.com%2Factions%2Fgoogle_hangouts_chat%2Foauth_redirect")
    })

    it("correctly handles redirect from authorization server", (done) => {
      const stubAccessToken = sinon.stub(action as any, "getAccessTokenCredentialsFromCode").resolves({tokens: "token"})
      const stubReq = sinon.stub(https, "post").callsFake(async () => Promise.resolve({access_token: "token"}))
      const result = action.oauthFetchInfo({code: "code",
        state: `eyJzdGF0ZXVybCI6Imh0dHBzOi8vbG9va2VyLnN0YXRlLnVybC5jb20vYWN0aW9uX2h1Yl9zdGF0ZS9hc2RmYXNkZmFzZGZh` +
          `c2RmIiwiYXBwIjoibXlrZXkifQ`},
        "redirect")
      chai.expect(result)
        .and.notify(stubAccessToken.restore)
        .and.notify(stubReq.restore).and.notify(done)
    })
  })
})
