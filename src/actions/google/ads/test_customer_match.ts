import * as b64 from "base64-url"
import * as chai from "chai"
import * as gaxios from "gaxios"
import { google } from "googleapis"
import * as sinon from "sinon"
import * as Hub from "../../../hub"
import { GoogleOAuthHelper } from "../common/oauth_helper"
import { GoogleAdsCustomerMatch } from "./customer_match"

/* I originally adopted the chai.should() format because of the explanation below, written at that time,
 * based on what was described in the chai-as-promised docs. However, it later became clear that mocha has other
 * features to handle this, and making the test cases themselves `async` is far preferable for simplicity and clarity.
 * So now I am continuing to use .should (without chai-as-promised at all) instead of changing all the assertions back.
 *
 * Old explanation which is still worth documenting:
 *
 * We need the `should` form of Chai to be able to use this pattern:
 *   chai.expect(promise).to.eventually.be.fullfilled.then(<more expectations>).should.notify(done)
 * Which allows us to make additional expectations after the original promise is resolved,
 * while properly passing the inner failures out to the test framework,
 * instead of them being masked by the outer promise.
 * See example under "Working with Non-Promise–Friendly Test Runners" here:
 *   https://www.chaijs.com/plugins/chai-as-promised/
 */
chai.should()

const testOAuthClientId = "test_oauth_client_id"
const testOAuthClientSecret = "test_oauth_client_secret"
const testAdsDeveloperToken = "test_ads_developer_token"
const testManagerCid = "test_manager_cid"

const action = new GoogleAdsCustomerMatch(
  testManagerCid,
  testAdsDeveloperToken,
  testOAuthClientId,
  testOAuthClientSecret,
)

describe(`${action.constructor.name} class`, () => {

  beforeEach(() => {
    sinon.stub(Hub.ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    sinon.stub(Hub.ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  afterEach(() => {
    sinon.restore() // root object is a default sandbox
  })

  describe("action properties", () => {
    it("hasForm", () => {
      action.hasForm.should.be.true
    })

    it("name", () => {
      action.name.should.equal("google_ads_customer_match")
    })

    it("label", () => {
      action.label.should.equal("Google Ads Customer Match")
    })

    it("iconName", () => {
      action.iconName.should.equal("google/ads/google_ads_icon.svg")
    })

    it("description", () => {
      action.description.should.equal("Upload data to Google Ads Customer Match.")
    })

    it("supportedActionTypes", () => {
      action.supportedActionTypes.should.deep.equal(["query"])
    })

    it("supportedFormats", () => {
      action.supportedFormats.should.deep.equal(["json_label"])
    })

    it("supportedFormattings", () => {
      action.supportedFormattings.should.deep.equal(["unformatted"])
    })

    it("supportedVisualizationFormattings", () => {
      action.supportedVisualizationFormattings.should.deep.equal(["noapply"])
    })

    it("supportedDownloadSettings", () => {
      action.supportedDownloadSettings.should.deep.equal(["url"])
    })

    it("usesStreaming", () => {
      action.usesStreaming.should.be.true
    })

    it("requiredFields", () => {
      action.requiredFields.should.be.empty
    })

    it("params", () => {
      const params = [{name: "clientCid", label: "Client Account ID (CID)", required: true, sensitive: false}]
      action.params.should.deep.equal(params)
    })

    it("redirectURI", () => {
      const url = `${process.env.ACTION_HUB_BASE_URL}/actions/google_ads_customer_match/oauth_redirect`
      action.redirectUri.should.equal(url)
    })

    it("oauthClientId", () => {
      action.oauthClientId.should.equal(testOAuthClientId)
    })

    it("oauthClientSecret", () => {
      action.oauthClientSecret.should.equal(testOAuthClientSecret)
    })

    it("oauthScopes", () => {
      action.oauthScopes.should.deep.equal(["https://www.googleapis.com/auth/adwords"])
    })

    it("oauthHelper", () => {
      action.oauthHelper.should.be.an.instanceOf(GoogleOAuthHelper)
    })
  })

  describe("oauth interface", () => {
    describe("oauthUrl", () => {
      it("generates the correct Google login URL", async () => {

        const urlPromise = action.oauthUrl(
          "https://action-hub.looker.test/actions/google_ads_customer_match/oauth_redirect",
          "not-actually-encrypted-payload-used-for-test",
        )

        const expectedUrl =
          "https://accounts.google.com/o/oauth2/v2/auth" +
          "?access_type=offline" +
          "&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords" +
          "&prompt=consent" +
          "&state=not-actually-encrypted-payload-used-for-test" +
          "&response_type=code" +
          "&client_id=test_oauth_client_id" +
          "&redirect_uri=https%3A%2F%2Faction-hub.looker.test%2Factions%2Fgoogle_ads_customer_match%2Foauth_redirect"

        return urlPromise.should.eventually.equal(expectedUrl)
      })
    })

    describe("oauthFetchInfo", () => {
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
        const oauthClientStub = sinon.stub(google.auth, "OAuth2").returns({getToken: getTokenStub})

        const postStub = sinon.stub(gaxios, "request").resolves("<action doesn't do anything with this post response>")
        const expectedPostArgs = {
          method: "POST",
          url: stateUrl,
          data: {tokens: stubTokens, redirect: redirectUri},
        }

        await action.oauthFetchInfo({code: oauthCode, state: encryptedPayload}, redirectUri)

        oauthClientStub.should.be.calledOnce
        oauthClientStub.getCall(0).args.should.deep.equal([
          "test_oauth_client_id",
          "test_oauth_client_secret",
          redirectUri,
        ])

        getTokenStub.should.be.calledOnce
        getTokenStub.getCall(0).args[0].should.equal(oauthCode)

        postStub.should.be.calledOnce
        postStub.getCall(0).args[0].should.deep.equal(expectedPostArgs)
      })
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
