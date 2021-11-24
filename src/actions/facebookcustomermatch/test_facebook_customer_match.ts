import * as b64 from "base64-url"
import { expect } from "chai"
import * as gaxios from "gaxios"
import * as sinon from "sinon"
import * as Hub from "../../hub"
import { FacebookCustomerMatchAction } from "./facebook_customer_match"
import { API_VERSION } from "./lib/api"

const testOAuthClientId = "test_oauth_client_id"
const testOAuthClientSecret = "test_oauth_client_secret"
const testClientCid = "test_client_cid"

const action = new FacebookCustomerMatchAction(
  testOAuthClientId,
  testOAuthClientSecret,
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
      expect(action.name).to.equal("facebook_customer_match")
    })

    it("label", () => {
      expect(action.label).to.equal("Facebook Customer Match")
    })

    it("iconName", () => {
      expect(action.iconName).to.equal("facebookcustomermatch/facebook_ads_icon.png")
    })

    it("description", () => {
      expect(action.description).to.equal("Upload data to Facebook Ads Custom Audience from Customer List")
    })

    it("supportedActionTypes", () => {
      expect(action.supportedActionTypes).to.deep.equal(["query"])
    })

    it("supportedFormats", () => {
      expect(action.supportedFormats).to.deep.equal(["json_detail"])
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

    it("oauthClientId", () => {
      expect(action.oauthClientId).to.equal(testOAuthClientId)
    })

    it("oauthClientSecret", () => {
      expect(action.oauthClientSecret).to.equal(testOAuthClientSecret)
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
            message: "Failed to execute Facebook Customer Match due to missing authentication credentials." +
            " No data sent to Facebook. Please try again or contact support",
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
        `https://www.facebook.com/${API_VERSION}/dialog/oauth?` +
        "client_id=test_oauth_client_id" +
        `&redirect_uri=https%3A%2F%2Faction-hub.looker.test%2Factions%2F${action.name}%2Foauth_redirect` +
        "&state=not-actually-encrypted-payload-used-for-test" +
        "&scope=read_insights%2Cads_management%2Cads_read%2Cbusiness_management%2Cpublic_profile"

        const actualUrl = await action.oauthUrl(
          `https://action-hub.looker.test/actions/${action.name}/oauth_redirect`,
          "not-actually-encrypted-payload-used-for-test",
        )

        expect(actualUrl).to.equal(expectedUrl)
      })
    })

    describe("oauthFetchInfo", () => {
      let gaxiosStub: sinon.SinonStub

      beforeEach(() => {
        gaxiosStub = adsSinonSandbox.stub(gaxios, "request")
      })

      it("correctly handles redirect from authorization server", async () => {
        const stateUrl = "https://a-looker-instance.looker.test/action_hub_state/asdfasdfasdfasdf"
        const encryptedPayload = b64.encode(JSON.stringify({stateUrl})) // based on how we stubbed ActionCrypto.encrypt

        const redirectUri = `https://action-hub.looker.test/actions/${action.name}/oauth_redirect`
        const oauthCode = "stringLikeAnOAuthCodeThatWouldBeSentByGoogle"
        const stubTokens = {
          longLivedToken: "anAccessTokenWooh",
        }

        gaxiosStub.resolves({ data: { access_token: stubTokens.longLivedToken } })

        const expectedGetArgs = {
            method: "GET",
            url: `https://graph.facebook.com/${API_VERSION}/oauth/access_token?client_id=${testOAuthClientId}` +
            `&redirect_uri=${redirectUri}&client_secret=${testOAuthClientSecret}&code=${oauthCode}`,
          }

        const expectedPostArgs = {
          method: "POST",
          url: stateUrl,
          data: {tokens: stubTokens, redirect: redirectUri},
        }

        await action.oauthFetchInfo({code: oauthCode, state: encryptedPayload}, redirectUri)

        expect(gaxiosStub.getCall(0).args[0]).to.deep.equal(expectedGetArgs)

        expect(gaxiosStub).to.be.calledTwice
        expect(gaxiosStub.getCall(1).args[0]).to.deep.equal(expectedPostArgs)
      })
    })

  })
})

function makeBaseRequest(optsArg?: any) {
  const defaultOpts = {
    listAction: "create_audience",
    doHashing: true,
  }
  const opts = Object.assign(defaultOpts, optsArg)
  const baseReq = new Hub.ActionRequest()
  baseReq.type = Hub.ActionType.Query

  if (opts.listAction === "create_audience") {
    baseReq.formParams = {
      choose_create_update_replace: "create_audience",
      create_audience_name: "New List Name from test suite",
      create_audience_description: "New List Description from test suite",
    }
  } else if (opts.listAction === "update_audience") {
    baseReq.formParams = {
      choose_create_update_replace: "update_audience",
    }
  } else if (opts.listAction === "replace_audience") {
    baseReq.formParams = {
      choose_create_update_replace: "replace_audience",
    }
  }

  baseReq.formParams.should_hash = opts.doHashing ? "do_hashing" : "do_no_hashing"

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
