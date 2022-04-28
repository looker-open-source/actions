import * as b64 from "base64-url"
import { expect } from "chai"
import * as gaxios from "gaxios"
import * as querystring from "querystring"
import * as sinon from "sinon"
import * as Hub from "../../../hub"
import { SalesforceOauthHelper } from "../common/oauth_helper"
import { FIELD_MAPPING, REDIRECT_URL, SalesforceCampaignsAction } from "./salesforce_campaigns"

const testOAuthClientId = "test_oauth_client_id"
const testOAuthClientSecret = "test_oauth_client_secret"
const testMaxResults = 10000
const testChunkSize = 200
const testSalesforceDomain = "https://notarealsalesforceorg.lightning.force.com"
const testStateUrl = "abc"

const validLookerData = {
    fields: { dimensions: [{ label: "Salesforce Contact Id", tags: ["sfdc_contact_id"], type: "string", name: "salesforce.contact_id" }]},
    data: [{ "salesforce.contact_id": { value: "abc" } }, { "salesforce.contact_id": { value: "def" } }],
}

const action = new SalesforceCampaignsAction(testOAuthClientId, testOAuthClientSecret, testMaxResults, testChunkSize)

describe(`${action.constructor.name} class`, () => {
  // Use a sandbox to avoid interaction with other test files
  const sinonSandbox = sinon.createSandbox()

  beforeEach(() => {
    sinonSandbox.stub(Hub.ActionCrypto.prototype, "encrypt").callsFake(async (s: string) => b64.encode(s))
    sinonSandbox.stub(Hub.ActionCrypto.prototype, "decrypt").callsFake(async (s: string) => b64.decode(s))
  })

  afterEach(() => {
    sinonSandbox.reset()
    sinonSandbox.restore()
  })

  describe("action properties", () => {
    it("hasForm", () => {
      expect(action.hasForm).to.be.true
    })

    it("name", () => {
      expect(action.name).to.equal("salesforce_campaigns")
    })

    it("label", () => {
      expect(action.label).to.equal("Salesforce Campaigns")
    })

    it("iconName", () => {
      expect(action.iconName).to.equal("salesforce/common/salesforce.png")
    })

    it("description", () => {
      expect(action.description).to.equal("Add contacts or leads to Salesforce campaign.")
    })

    it("supportedActionTypes", () => {
      expect(action.supportedActionTypes).to.deep.equal(["query"])
    })

    it("supportedFormats", () => {
      expect(action.supportedFormats).to.deep.equal(["json_detail_lite_stream"])
    })

    it("supportedFormattings", () => {
      expect(action.supportedFormattings).to.deep.equal(["unformatted"])
    })

    it("supportedVisualizationFormattings", () => {
      expect(action.supportedVisualizationFormattings).to.deep.equal(["noapply"])
    })

    it("supportedDownloadSettings", () => {
      expect(action.supportedDownloadSettings).to.deep.equal(["push"])
    })

    it("minimumSupportedLookerVersion", () => {
      expect(action.minimumSupportedLookerVersion).to.deep.equal("22.6.0")
    })

    it("usesStreaming", () => {
      expect(action.usesStreaming).to.be.false
    })

    it("requiredFields", () => {
      expect(action.requiredFields).to.be.deep.equal([{ any_tag: ["sfdc_contact_id", "sfdc_lead_id"] }])
    })

    it("params", () => {
      expect(action.params).to.be.deep.equal([
        {
          description:
            "Salesforce domain name, e.g. https://MyDomainName.my.salesforce.com",
          label: "Salesforce domain",
          name: "salesforce_domain",
          required: true,
          sensitive: false,
          user_attribute_name: "salesforce_campaigns_action_domain",
        },
      ])
    })

    it("oauthClientId", () => {
      expect(action.sfdcOauthHelper.oauthCreds.oauthClientId).to.equal(testOAuthClientId)
    })

    it("oauthClientSecret", () => {
      expect(action.sfdcOauthHelper.oauthCreds.oauthClientSecret).to.equal(testOAuthClientSecret)
    })

    it("maxResults", () => {
      expect(action.sfdcCampaignsFormBuilder.maxResults).to.equal(testMaxResults)
    })

    it("chunkSize", () => {
      expect(action.sfdcCampaignsSendData.chunkSize).to.equal(testChunkSize)
    })

    it("oauthHelper", () => {
      expect(action.sfdcOauthHelper).to.be.an.instanceOf(SalesforceOauthHelper)
    })
  })

  describe("execute endpoint", () => {
    const request = new Hub.ActionRequest()
    request.type = Hub.ActionType.Query

    it("errors if there is no salesforce domain param", () => {
      const actualResponse = action.validateAndExecute(request)
      expect(actualResponse).to.eventually.be.rejectedWith('Required setting "Salesforce domain" not specified in action settings.')
    })

    it("errors if there is no json", () => {
      request.params.salesforce_domain = testSalesforceDomain
      const actualResponse = action.validateAndExecute(request)
      expect(actualResponse).to.eventually.be.rejectedWith("No attached json.")
    })

    it("errors if there is no salesforce compaign name", () => {
      request.attachment = { dataJSON: { some: "data" } }
      const actualResponse = action.validateAndExecute(request)
      expect(actualResponse).to.eventually.be.rejectedWith("Missing Salesforce campaign name.")
    })

    it("errors if payload is an invalid format", () => {
      request.formParams.campaign_name = "my new campaign"
      const actualResponse = action.validateAndExecute(request)
      expect(actualResponse).to.eventually.be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if there is no state_json", () => {
      request.attachment = { dataJSON: { fields: {}, data: [] } }
      const actualResponse = action.validateAndExecute(request)
      expect(actualResponse).to.eventually.be.rejectedWith("Request is missing state_json.")
    })

    it("errors if there is no tag or regex match", () => {
      request.params.state_json = JSON.stringify({ not: "a token" })
      const actualResponse = action.validateAndExecute(request)

      const resp = new Hub.ActionResponse()
      resp.success = false
      const fieldMapping = FIELD_MAPPING.map((fm: any) => {
        fm.fallbackRegex = fm.fallbackRegex.toString()
        return fm
      })
      resp.message = `Query requires at least 1 field with a tag or regex match: ${JSON.stringify(fieldMapping)}`

      expect(actualResponse).to.eventually.be.deep.equal(resp)
    })

    it("returns an error response if there is no tokens", async () => {
      request.attachment = { dataJSON: validLookerData }
      const expectedResponse = makeErrorResponse({message: "Request state is missing code and redirect"})
      const actualResponse = await action.validateAndExecute(request)

      expect(actualResponse).to.deep.equal(expectedResponse)
    })
  })

  describe("oauth interface", () => {
    const payloadString = JSON.stringify({
      stateUrl: testStateUrl,
      salesforce_domain: testSalesforceDomain,
      salesforceClientId: testOAuthClientId,
    })
    const encryptedPayload = b64.encode(payloadString) // based on how we stubbed ActionCrypto.encrypt
    const startAuthUrl = `${process.env.ACTION_HUB_BASE_URL}/actions/salesforce_campaigns/oauth?state=${encryptedPayload}`

    it("generates the correct Salesforce login URL", async () => {
      const form = new Hub.ActionForm()
      form.state = new Hub.ActionState()
      form.state.data = "reset"
      form.fields = []
      form.fields.push({
        name: "login",
        type: "oauth_link",
        label: "Log in",
        description:
          "In order to send to this destination, you will need to log in" +
          " once to your Salesforce account.",
        oauth_url: startAuthUrl,
      })

      const request = new Hub.ActionRequest()
      request.params.salesforce_domain = testSalesforceDomain
      request.params.state_url = testStateUrl
      const actualForm = await action.sfdcOauthHelper.makeLoginForm(request)

      expect(form).to.be.deep.equal(actualForm)
    })

    it("generates the correct oauthUrl", async () => {
      const authorizeUrl = `${testSalesforceDomain}/services/oauth2/authorize`
      const expectedAuthUrl = new URL(authorizeUrl)
      expectedAuthUrl.search = querystring.stringify({
        response_type: "code",
        client_id: testOAuthClientId,
        redirect_uri: REDIRECT_URL,
        state: encryptedPayload,
      })

      const actualAuthUrl = await action.oauthUrl(REDIRECT_URL, encryptedPayload)

      expect(actualAuthUrl).to.equal(expectedAuthUrl.toString())
    })

    it("correctly handles redirect from authorization server", async () => {
      const gaxiosStub = sinonSandbox.stub(gaxios, "request")
      gaxiosStub.resolves("<action doesn't do anything with this post response>")

      const redirectUri = `https://action-hub.looker.test/actions/${action.name}/oauth_redirect`
      const oauthCode = "stringLikeAnOAuthCodeThatWouldBeSentBySalesforce"
      const expectedPostArgs = {
        method: "POST",
        url: testStateUrl,
        data: { code: oauthCode, redirect: redirectUri },
      }

      await action.oauthFetchInfo({ code: oauthCode, state: encryptedPayload }, redirectUri)

      expect(gaxiosStub).to.be.calledOnce
      expect(gaxiosStub.getCall(0).args[0]).to.deep.equal(expectedPostArgs)
    })
  })
})

function makeErrorResponse(optsArg?: { message?: string }) {
  const resp = new Hub.ActionResponse()
  resp.success = false

  if (optsArg && optsArg.message) {
    resp.message = optsArg.message
  }

  return resp
}
