import * as b64 from "base64-url"
import { expect } from "chai"
import * as gaxios from "gaxios"
import { google } from "googleapis"
import * as sinon from "sinon"
import * as Hub from "../../../hub"
import { GoogleOAuthHelper } from "../common/oauth_helper"
import { GoogleAdsCustomerMatch } from "./customer_match"

const testOAuthClientId = "test_oauth_client_id"
const testOAuthClientSecret = "test_oauth_client_secret"
const testAdsDeveloperToken = "test_ads_developer_token"
const testClientCid = "test_client_cid"

const action = new GoogleAdsCustomerMatch(
  testOAuthClientId,
  testOAuthClientSecret,
  testAdsDeveloperToken,
)

describe(`${action.constructor.name} class`, () => {
  // Use a sandbox to avoid interaction with other test files
  const adsSinonSandbox = sinon.createSandbox()

  beforeEach(() => {
    adsSinonSandbox.stub(Hub.ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    adsSinonSandbox.stub(Hub.ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  afterEach(() => {
    adsSinonSandbox.reset()
    adsSinonSandbox.restore()
  })

  describe("action properties", () => {
    it("hasForm", () => {
      expect(action.hasForm).to.be.true
    })

    it("name", () => {
      expect(action.name).to.equal("google_ads_customer_match")
    })

    it("label", () => {
      expect(action.label).to.equal("Google Ads Customer Match")
    })

    it("iconName", () => {
      expect(action.iconName).to.equal("google/ads/google_ads_icon.svg")
    })

    it("description", () => {
      expect(action.description).to.equal("Upload data to Google Ads Customer Match.")
    })

    it("supportedActionTypes", () => {
      expect(action.supportedActionTypes).to.deep.equal(["query"])
    })

    it("supportedFormats", () => {
      expect(action.supportedFormats).to.deep.equal(["json_label"])
    })

    it("supportedFormattings", () => {
      expect(action.supportedFormattings).to.deep.equal(["unformatted"])
    })

    it("supportedVisualizationFormattings", () => {
      expect(action.supportedVisualizationFormattings).to.deep.equal(["noapply"])
    })

    it("supportedDownloadSettings", () => {
      expect(action.supportedDownloadSettings).to.deep.equal(["url"])
    })

    it("usesStreaming", () => {
      expect(action.usesStreaming).to.be.true
    })

    it("requiredFields", () => {
      expect(action.requiredFields).to.be.empty
    })

    it("params", () => {
      expect(action.params).to.be.empty
    })

    it("redirectURI", () => {
      const url = `${process.env.ACTION_HUB_BASE_URL}/actions/google_ads_customer_match/oauth_redirect`
      expect(action.redirectUri).to.equal(url)
    })

    it("developerToken", () => {
      expect(action.developerToken).to.equal(testAdsDeveloperToken)
    })

    it("oauthClientId", () => {
      expect(action.oauthClientId).to.equal(testOAuthClientId)
    })

    it("oauthClientSecret", () => {
      expect(action.oauthClientSecret).to.equal(testOAuthClientSecret)
    })

    it("oauthScopes", () => {
      expect(action.oauthScopes).to.deep.equal(["https://www.googleapis.com/auth/adwords"])
    })

    it("oauthHelper", () => {
      expect(action.oauthHelper).to.be.an.instanceOf(GoogleOAuthHelper)
    })
  })

  describe("execute endpoint", () => {
    describe("oauth token checks", () => {

      const tests = [
        {name: "no user state"},
        {name: "no tokens", state: {redirect: "redirect is present"}},
        {name: "no redirect", state: {tokens: {access_token: "access", refresh_token: "refresh"}}},
      ]

      for (const test of tests) {
        it(`returns an error response if there is ${test.name}`, async () => {
          const request = makeBaseRequest()
          if (!test.state) {
            delete request.params.state_json
          } else {
            request.params.state_json = JSON.stringify(test.state)
          }

          const expectedResponse = makeErrorResponse({
            message: "MissingAuthError: User state was missing or did not contain oauth tokens & redirect",
          })

          const actualResponse = await action.validateAndExecute(request)
          expect(actualResponse).to.deep.equal(expectedResponse)
        })
      }
    })
  })

  describe("oauth interface", () => {
    describe("oauthUrl", () => {
      it("generates the correct Google login URL", async () => {
        const expectedUrl =
          "https://accounts.google.com/o/oauth2/v2/auth" +
          "?access_type=offline" +
          "&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords" +
          "&prompt=consent" +
          "&state=not-actually-encrypted-payload-used-for-test" +
          "&response_type=code" +
          "&client_id=test_oauth_client_id" +
          `&redirect_uri=https%3A%2F%2Faction-hub.looker.test%2Factions%2F${action.name}%2Foauth_redirect`

        const actualUrl = await action.oauthUrl(
          `https://action-hub.looker.test/actions/${action.name}/oauth_redirect`,
          "not-actually-encrypted-payload-used-for-test",
        )

        expect(actualUrl).to.equal(expectedUrl)
      })
    })

    describe("oauthFetchInfo", () => {
      let oauthClientStub: sinon.SinonStub
      let gaxiosStub: sinon.SinonStub

      beforeEach(() => {
        oauthClientStub = adsSinonSandbox.stub(google.auth, "OAuth2")
        gaxiosStub = adsSinonSandbox.stub(gaxios, "request")
      })

      it("correctly handles redirect from authorization server", async () => {
        const stateUrl = "https://a-looker-instance.looker.test/action_hub_state/asdfasdfasdfasdf"
        const encryptedPayload = b64.encode(JSON.stringify({stateUrl})) // based on how we stubbed ActionCrypto.encrypt

        const redirectUri = `https://action-hub.looker.test/actions/${action.name}/oauth_redirect`
        const oauthCode = "stringLikeAnOAuthCodeThatWouldBeSentByGoogle"
        const stubTokens = {
          access_token: "anAccessTokenWooh",
          refresh_token: "theRefreshTokenYeah",
        }

        const getTokenStub = sinon.fake.resolves({tokens: stubTokens})

        oauthClientStub.returns({getToken: getTokenStub})
        gaxiosStub.resolves("<action doesn't do anything with this post response>")

        const expectedPostArgs = {
          method: "POST",
          url: stateUrl,
          data: {tokens: stubTokens, redirect: redirectUri},
        }

        await action.oauthFetchInfo({code: oauthCode, state: encryptedPayload}, redirectUri)

        expect(oauthClientStub).to.be.calledOnce
        expect(oauthClientStub.getCall(0).args).to.deep.equal([
          "test_oauth_client_id",
          "test_oauth_client_secret",
          redirectUri,
        ])

        expect(getTokenStub).to.be.calledOnce
        expect(getTokenStub.getCall(0).args[0]).to.equal(oauthCode)

        expect(gaxiosStub).to.be.calledOnce
        expect(gaxiosStub.getCall(0).args[0]).to.deep.equal(expectedPostArgs)
      })

      // TODO: test for Looker's whacky HTTP response codes
    })

    /* This part of the Action API appears to be deprecated - omitting tests
    describe("oauthCheck", () => {
      it("returns false if there is no state_json in the request")
      it("returns false if the state_json cannot be parsed")
      it("returns false if the parsed stateJson does not not have tokens")
      it("returns false if the parsed stateJson does not not have a redirect uri")
      it("returns true if the api call is successful")
      it("wraps and re-throws any exceptions generated by the api")
    })
    */
  })
})

function makeBaseRequest(optsArg?: any) {
  const defaultOpts = {
    createNewList: false,
    doHashing: true,
  }
  const opts = Object.assign(defaultOpts, optsArg)
  const baseReq = new Hub.ActionRequest()
  baseReq.type = Hub.ActionType.Query

  if (opts.createNewList) {
    baseReq.formParams = {
      userListResourceName: "Create new list...",
      newListName: "New List Name from test suite",
      newListDescription: "New List Description from test suite",
    }
  } else {
    baseReq.formParams = {
      userListResourceName: "existingListNameForTest",
    }
  }

  baseReq.formParams.doHashing = opts.doHashing ? "yes" : "no"

  const lookerData = [
    {"User Email": "aaa@example.com"},
    {"User Email": "bbb@example.com"},
    {"User Email": "ccc@example.com"},
  ]
  const attachmentData = Buffer.from(JSON.stringify(lookerData))

  baseReq.attachment = {dataBuffer: attachmentData, fileExtension: "json_label"}

  baseReq.params = {
    clientCid: testClientCid,
    state_url: "https://action-hub.looker.test/action_hub_state/asdfasdfasdfasdf",
    state_json: JSON.stringify({
      tokens: {access_token: "accesstoken", refresh_token: "refreshtoken"},
      redirect: "redirecturl",
    }),
  }

  return baseReq
}

function makeErrorResponse(optsArg?: {withReset?: boolean, message?: string}) {
  const defaultOpts = {
    withReset: true,
  }
  const opts = Object.assign(defaultOpts, optsArg)

  const resp = new Hub.ActionResponse()
  resp.success = false

  if (opts.withReset) {
    resp.state = new Hub.ActionState()
    resp.state.data = "reset"
  }

  if (opts.message) {
    resp.message = opts.message
  }

  return resp
}
