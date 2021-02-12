import * as b64 from "base64-url"
import * as chai from "chai"
import concatStream = require("concat-stream")
import * as gaxios from "gaxios"
import { analytics_v3, google } from "googleapis"
import * as sinon from "sinon"
import * as Hub from "../../../hub"
import { GoogleOAuthHelper } from "../common/oauth_helper"
import { GoogleAnalyticsDataImportAction } from "./data_import"

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

const teastOAuthClientId = "test_oauth_client_id"
const teastOAuthClientSecret = "test_oauth_client_secret"

const action = new GoogleAnalyticsDataImportAction(teastOAuthClientId, teastOAuthClientSecret)

describe(`${action.constructor.name} class`, () => {

  beforeEach(() => {
    sinon.stub(Hub.ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    sinon.stub(Hub.ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
  })

  let gaClientStub: sinon.SinonStub
  let accountSummariesListStub: sinon.SinonStub
  let uploadsListStub: sinon.SinonStub
  let uploadDataStub: sinon.SinonStub
  let deleteUploadDataStub: sinon.SinonStub
  let customDataSourcesListStub: sinon.SinonStub

  beforeEach(() => {
    accountSummariesListStub = sinon.stub()
    uploadsListStub = sinon.stub()
    uploadDataStub = sinon.stub()
    deleteUploadDataStub = sinon.stub()
    customDataSourcesListStub = sinon.stub()

    gaClientStub = sinon.stub(google, "analytics")
    gaClientStub.returns({
      management: {
        accountSummaries: {
          list: accountSummariesListStub,
        },
        uploads: {
          list: uploadsListStub,
          uploadData: uploadDataStub,
          deleteUploadData: deleteUploadDataStub,
        },
        customDataSources: {
          list: customDataSourcesListStub,
        },
      },
    })
  })

  afterEach(() => {
    sinon.restore() // root object is a default sandbox
  })

  describe("action properties", () => {
    it("hasForm", () => {
      action.hasForm.should.be.true
    })

    it("name", () => {
      action.name.should.equal("google_analytics_data_import")
    })

    it("label", () => {
      action.label.should.equal("Google Analytics Data Import")
    })

    it("iconName", () => {
      action.iconName.should.equal("google/analytics/google_analytics_icon.svg")
    })

    it("description", () => {
      action.description.should.equal("Upload data to a custom Data Set in Google Analytics.")
    })

    it("supportedActionTypes", () => {
      action.supportedActionTypes.should.deep.equal(["query"])
    })

    it("supportedFormats", () => {
      action.supportedFormats.should.deep.equal(["csv"])
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
      action.params.should.be.empty
    })

    it("redirectURI", () => {
      const url = `${process.env.ACTION_HUB_BASE_URL}/actions/google_analytics_data_import/oauth_redirect`
      action.redirectUri.should.equal(url)
    })

    it("oauthClientId", () => {
      action.oauthClientId.should.equal(teastOAuthClientId)
    })

    it("oauthClientSecret", () => {
      action.oauthClientSecret.should.equal(teastOAuthClientSecret)
    })

    it("oauthScopes", () => {
      action.oauthScopes.should.deep.equal(["https://www.googleapis.com/auth/analytics.edit"])
    })

    it("oauthHelper", () => {
      action.oauthHelper.should.be.an.instanceOf(GoogleOAuthHelper)
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
            message:
              "Error during action setup:"
              + " MissingAuthError: User state was missing or did not contain tokens & redirect",
          })

          const actualResponse = await action.validateAndExecute(request)
          actualResponse.should.deep.equal(expectedResponse)
        })
      }
    })

    describe("required param checks", () => {
      it("returns an error if dataSourceCompositeId is not present", async () => {
        const request = makeBaseRequest()

        delete request.formParams.dataSourceCompositeId

        const expectedResponse = makeErrorResponse({
          withReset: false,
          message: "Error during data upload step:"
            + " MissingRequiredParamsError: Did not receive required form param 'dataSourceCompositeId'",
        })

        const actualResponse = await action.validateAndExecute(request)
        actualResponse.should.deep.equal(expectedResponse)
      })

      it("returns an error if dataSourceSchema is not present", async () => {
        const request = makeBaseRequest()

        delete request.formParams.dataSourceSchema

        const expectedResponse = makeErrorResponse({
          withReset: false,
          message: "Error during data upload step:"
            + " MissingRequiredParamsError: Did not receive required form param 'dataSourceSchema'",
        })

        const actualResponse = await action.validateAndExecute(request)
        actualResponse.should.deep.equal(expectedResponse)
      })
    })

    describe("ga client setup", () => {
      it("returns an error response if the api client setup fails", async () => {
        const request = makeBaseRequest()

        const testException = new TestException("error in ga client setup")
        gaClientStub.throws(testException)

        const expectedResponse = makeErrorResponse({withReset: false})
        expectedResponse.message = `Error during action setup: ${testException.toString()}`

        const actualResponse = await action.validateAndExecute(request)

        actualResponse.should.deep.equal(expectedResponse)
      })
    })

    describe("upload file step", () => {

      it("returns an error response if the upload helper throws an exception", async () => {
        const request = makeBaseRequest()

        const testException = new TestException("error in file upload")
        uploadDataStub.throws(testException)

        const expectedResponse = makeErrorResponse({withReset: false})
        expectedResponse.message = `Error during data upload step: ${testException.toString()}`

        const actualResponse = await action.validateAndExecute(request)

        actualResponse.should.deep.equal(expectedResponse)
      })

      it("makes the correct API call with correctly transformed data", async () => {
        const request = makeBaseRequest({deleteOtherFiles: "no"})

        const expectedCsv = Buffer.from("new_header_1,new_header_2\ndata_1,data_2")

        const expectedApiArgs: analytics_v3.Params$Resource$Management$Uploads$Uploaddata = {
          accountId: "111",
          customDataSourceId: "333",
          webPropertyId: "222",
        }

        uploadDataStub.resolves({data: {id: "NewUploadIdFromTest"}})

        const actualResponse = await action.validateAndExecute(request)

        // Check the basics
        actualResponse.should.exist
        actualResponse.success.should.be.true
        gaClientStub.should.be.calledOnce
        uploadDataStub.should.be.calledOnce

        // Split buffer from other args for easier comparison
        const actualApiArgs = uploadDataStub.getCall(0).args[0]
        const actualBuffer = actualApiArgs.media.body
        delete actualApiArgs.media

        // Check the accountId, customDataSourceId, webPropertyId params
        actualApiArgs.should.be.deep.equal(expectedApiArgs)

        // Check the actual data
        actualBuffer.pipe(concatStream((buff: Buffer) => {
          buff.toString().should.equal(expectedCsv.toString())
        }))
      })

      it("returns an error response if the api throws an exception", async () => {
        const request = makeBaseRequest()

        const testException = new TestException("message from uploadData test stub")
        uploadDataStub.throws(testException)

        const actualResponse = await action.validateAndExecute(request)

        actualResponse.should.deep.equal({
          success: false,
          message: `Error during data upload step: ${testException.toString()}`,
          refreshQuery: false,
          validationErrors: [],
        })
      })
    })

    describe("update lastUsedFormParams in user state", () => {
      it("does not occur if the upload step failed", async () => {
        const request = makeBaseRequest()

        const testException = new TestException("message from uploadData test stub")
        uploadDataStub.throws(testException)

        const actualResponse = await action.validateAndExecute(request)

        actualResponse.should.deep.equal({
          success: false,
          message: `Error during data upload step: ${testException.toString()}`,
          refreshQuery: false,
          validationErrors: [],
        })
      })

      it("updates the values to the form params used on this run", async () => {
        const request = makeBaseRequest({deleteOtherFiles: "nope"})

        uploadDataStub.resolves({data: {id: "fakeNewIdFromTest"}})

        const actualResponse = await action.validateAndExecute(request)

        actualResponse.should.have.nested.property("state.data").that.is.a("string")

        const state = JSON.parse(actualResponse.state!.data!)

        state.lastUsedFormParams.should.deep.equal({
          dataSourceCompositeId: "111::222::333",
          dataSourceSchema: "new_header_1,new_header_2",
          deleteOtherFiles: "nope",
        })
      })
    })

    describe("delete other files step", () => {
      it("does not occur if the deleteOtherFiles param is not present", async () => {
        const request = makeBaseRequest()

        delete request.formParams.deleteOtherFiles

        uploadDataStub.resolves({data: {id: "fakeNewIdFromTest"}})

        const actualResponse = await action.validateAndExecute(request)
        actualResponse.success.should.be.true

        deleteUploadDataStub.should.not.be.called
      })

      it("does not occur if the deleteOtherFiles param is not 'yes'", async () => {
        const request = makeBaseRequest()

        request.formParams.deleteOtherFiles = "no"

        uploadDataStub.resolves({data: {id: "fakeNewIdFromTest"}})

        const actualResponse = await action.validateAndExecute(request)
        actualResponse.success.should.be.true

        deleteUploadDataStub.should.not.be.called
      })

      it("does not occur if the upload failed", async () => {
        const request = makeBaseRequest()

        uploadDataStub.throws(new TestException("message from uploadData test stub"))

        const actualResponse = await action.validateAndExecute(request)
        actualResponse.success.should.be.false

        deleteUploadDataStub.should.not.be.called
      })

      it("deletes all files except the one that was just created", async () => {
        const request = makeBaseRequest()

        uploadDataStub.resolves({data: {id: "fakeNewIdFromTest"}})

        uploadsListStub.resolves({data: {items: [
          {id: "fakeNewIdFromTest"},
          {id: "willBeDeleted"},
          {id: "goinGitGone"},
          {name: "surprise no id"},
        ]}})

        const actualResponse = await action.validateAndExecute(request)
        actualResponse.success.should.be.true

        deleteUploadDataStub.should.be.calledOnce
        deleteUploadDataStub.getCall(0).args[0].should.deep.equal({
          accountId: "111",
          customDataSourceId: "333",
          webPropertyId: "222",
          requestBody: {
            customDataImportUids: ["willBeDeleted", "goinGitGone"],
          },
        })
      })

      it("returns an error response if it fails", async () => {
        const request = makeBaseRequest()

        uploadDataStub.resolves({data: {id: "fakeNewIdFromTest"}})

        const testException = new TestException("message from uploads.list test stub")
        uploadsListStub.throws(testException)

        const response = await action.validateAndExecute(request)

        response.should.be.an.instanceOf(Hub.ActionResponse)
        response.should.have.property("success", false)
        response.should.have.property("message",
          `Error during delete other files step: ${testException.toString()}`,
        )
      })
    })
  })

  describe("form endpoint", () => {

    function makeLoginForm(stateUrl: string) {
      const encryptedPayload = b64.encode(JSON.stringify({stateUrl})) // based on how we stubbed ActionCrypto.encrypt

      const oauthUrl = `${process.env.ACTION_HUB_BASE_URL}/actions/${action.name}/oauth?state=${encryptedPayload}`

      const form = new Hub.ActionForm()
      form.state = new Hub.ActionState()
      form.state.data = "reset"
      form.fields = []
      form.fields.push({
        name: "login",
        type: "oauth_link_google",
        label: "Log in",
        description: "In order to send to this destination, you will need to log in once to your Google account.",
        oauth_url: oauthUrl,
      })
      return form
    }

    type DataSetSelectOptions = { name: string, label: string }[] | []

    function makeForm(
      username: string,
      lastUsedFormParams: any,
      dataSetSelectOptions: DataSetSelectOptions,
      ) {

      const {lastUsedCompositeId, lastUsedSchema, lastUsedDeleteOtherFiles} = lastUsedFormParams

      const form = new Hub.ActionForm()
      form.fields = []

      form.fields.push({
        name: "dataSourceCompositeId",
        label: "Data Set",
        type: "select",
        description: `Account Name >> Property Name >> Data Set. You are currently logged in as ${username}`,
        options: dataSetSelectOptions,
        default: lastUsedCompositeId ? lastUsedCompositeId : "",
        required: true,
      })

      form.fields.push({
        name: "dataSourceSchema",
        label: "Data Set Schema",
        type: "string",
        description: "Get this value from the Data Set definition in GA."
          + " The format is like \"ga:dimension1,ga:dimension2\" without quotes.",
        default: lastUsedSchema ? lastUsedSchema : "",
        required: true,
      })

      form.fields.push({
        name: "deleteOtherFiles",
        label: "Delete Other Files?",
        type: "select",
        description: "If 'Yes', then all other files in the data set will be deleted after this upload is complete.",
        options: [{name: "yes", label: "Yes"}, {name: "no", label: "No"}],
        default: lastUsedDeleteOtherFiles ? lastUsedDeleteOtherFiles : "",
        required: true,
      })

      return form
    }

    describe("token checks", () => {
      const tests = [
        {name: "no user state"},
        {name: "no tokens", state: {redirect: "redirect is present"}},
        {name: "no redirect", state: {tokens: {access_token: "access", refresh_token: "refresh"}}},
      ]

      for (const test of tests) {
        it(`returns an oauth login form if there is ${test.name}`, async () => {
          const request = new Hub.ActionRequest()
          request.params = {
            state_url: "https://a-looker-instance.looker.test/action_hub_state/asdfasdfasdfasdf",
          }

          if (test.state) {
            request.params.state_json = JSON.stringify(test.state)
          }

          const expectedForm = makeLoginForm(request.params.state_url!)

          const actualForm = await action.validateAndFetchForm(request)

          actualForm.should.deep.equal(expectedForm)
        })
      }
    })

    it("returns a form with default values set to lastUsedFormParams, if provided", async () => {
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://a-looker-instance.looker.test/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "valid_tokens", redirect: "valid_url"}),
      }

      const username = "action_hub_user@looker.test"
      const dataSetSelectOptions: DataSetSelectOptions = []
      const lastUsedFormParams = {
        dataSourceCompositeId: "111::222::333",
        dataSourceSchema: "new_header_1,new_header_2",
        deleteOtheFiles: "yes",
      }

      accountSummariesListStub.resolves({data: {username}})

      const expectedForm = makeForm(username, lastUsedFormParams, dataSetSelectOptions)
      const actualForm = await action.validateAndFetchForm(request)

      actualForm.should.deep.equal(expectedForm)
    })

    it("returns a form with blank default values if lastUsedFormParams was not provided", async () => {
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://a-looker-instance.looker.test/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "valid_tokens", redirect: "valid_url"}),
      }

      const username = "action_hub_user@looker.test"
      const dataSetSelectOptions: DataSetSelectOptions = []
      const lastUsedFormParams = {
        lastUsedCompositeId: "",
        lastUsedSchema: "",
        lastUsedDeleteOtherFiles: "",
      }

      accountSummariesListStub.resolves({data: {username}})

      const expectedForm = makeForm(username, lastUsedFormParams, dataSetSelectOptions)
      const actualForm = await action.validateAndFetchForm(request)

      actualForm.should.deep.equal(expectedForm)
    })

    it("returns the correct data source options for a complex situation", async () => {
      const request = new Hub.ActionRequest()
      request.params = {
        state_url: "https://a-looker-instance.looker.test/action_hub_state/asdfasdfasdfasdf",
        state_json: JSON.stringify({tokens: "valid_tokens", redirect: "valid_url"}),
      }

      const username = "action_hub_user@looker.test"
      const items = [
        {
          id: "111",
          name: "Mocha Account 1",
          webProperties: [
            {id: "p11", name: "Property 11"},
            {id: "p12", name: "Property 12"},
          ],
        }, {
          id: "222",
          name: "Mocha Account 2",
          webProperties: [
            {id: "p21", name: "Property 21"},
            {id: "p22", name: "Property 22"},
          ],
        },
      ]

      accountSummariesListStub.resolves({
        data: {
          username,
          items,
        },
      })

      const call0resp = {
        data: {
          totalResults: 1,
          items: [
            // A PROPER OBJECT W/ EVERYTHING CORRECT
            {
              id: "ds111",
              name: "Data Source 111",
              accountId: "111",
              webPropertyId: "p11",
            },
            // AN OBJECT MISSING PROPS
            {
              id: "ds112",
              name: "Data Source 112",
            },
            // AN OBJECT W/ MISMATCHED PROPERTY ID
            {
              id: "ds113",
              name: "Data Source 113",
              accountId: "111",
              webPropertyId: "someBogusPropId",
            },
          ],
        },
      }

      const call1resp = {
        data: {
          // A RESPONSE WITH NO ITEMS
          totalResults: 0,
        },
      }

      const call2resp = {
        data: {
          totalResults: 1,
          items: [
            // A PROPER OBJECT W/ EVERYTHING CORRECT
            {
              id: "ds211",
              name: "Data Source 211",
              accountId: "222",
              webPropertyId: "p21",
            },
          ],
        },
      }

      const call3resp = new TestException("exception from customDataSources")

      customDataSourcesListStub.onCall(0).resolves(call0resp)
      customDataSourcesListStub.onCall(1).resolves(call1resp)
      customDataSourcesListStub.onCall(2).resolves(call2resp)
      customDataSourcesListStub.onCall(3).rejects(call3resp)

      const form = await action.validateAndFetchForm(request)
      const actualSelectOptions = (form.fields[0] as any).options

      customDataSourcesListStub.callCount.should.equal(4)

      customDataSourcesListStub.getCall(0).args[0].should.deep.equal({
        accountId: "111",
        webPropertyId: "p11",
      })

      customDataSourcesListStub.getCall(1).args[0].should.deep.equal({
        accountId: "111",
        webPropertyId: "p12",
      })

      customDataSourcesListStub.getCall(2).args[0].should.deep.equal({
        accountId: "222",
        webPropertyId: "p21",
      })

      customDataSourcesListStub.getCall(3).args[0].should.deep.equal({
        accountId: "222",
        webPropertyId: "p22",
      })

      actualSelectOptions.should.deep.equal([
        {name: "111::p11::ds111", label: "Mocha Account 1 >> Property 11 >> Data Source 111"},
        {name: "222::p21::ds211", label: "Mocha Account 2 >> Property 21 >> Data Source 211"},
      ])

    })
  })

  describe("oauth endpoints", () => {
    describe("oauthUrl", () => {
      it("generates the correct Google login URL", async () => {
        const expectedUrl =
          "https://accounts.google.com/o/oauth2/v2/auth" +
          "?access_type=offline" +
          "&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fanalytics.edit" +
          "&prompt=consent" +
          "&state=not-actually-encrypted-payload-used-for-test" +
          "&response_type=code" +
          "&client_id=test_oauth_client_id" +
          "&redirect_uri=https%3A%2F%2Faction-hub.looker.test%2Factions%2Fgoogle_analytics_data_import%2Foauth_redirect"

        const actualUrl = await action.oauthUrl(
          "https://action-hub.looker.test/actions/google_analytics_data_import/oauth_redirect",
          "not-actually-encrypted-payload-used-for-test",
        )

        actualUrl.should.equal(expectedUrl)
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

      it("throws an exception if the POST to Looker fails", async () => {
        const stateUrl = "https://a-looker-instance.looker.test/action_hub_state/asdfasdfasdfasdf"
        const encryptedPayload = b64.encode(JSON.stringify({stateUrl})) // based on how we stubbed ActionCrypto.encrypt

        const redirectUri = `https://action-hub.looker.test/actions/${action.name}/oauth_redirect`
        const oauthCode = "stringLikeAnOAuthCodeThatWouldBeSentByGoogle"
        const stubTokens = {
          access_token: "anAccessTokenWooh",
          refresh_token: "theRefreshTokenYeah",
        }

        const getTokenStub = sinon.fake.resolves({tokens: stubTokens})
        sinon.stub(google.auth, "OAuth2").returns({getToken: getTokenStub})

        const testException = new TestException("<error message from POST to Looker>")

        sinon.stub(gaxios, "request").throws(testException)

        const run = async () => {
          return action.oauthFetchInfo({code: oauthCode, state: encryptedPayload}, redirectUri)
        }

        return run().should.eventually.be.rejectedWith(testException)
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

/******** Helpers ********/

class TestException extends Error {
  constructor(message?: string) {
    super(message)
    // See https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html#support-for-newtarget
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

function makeBaseRequest(optsArg?: any) {
  const defaultOpts = {
    deleteOtherFiles: "yes",
  }
  const opts = Object.assign(defaultOpts, optsArg)
  const baseReq = new Hub.ActionRequest()
  baseReq.type = Hub.ActionType.Query

  const originalCsv = Buffer.from("original_header_1,original_header_2\ndata_1,data_2")

  baseReq.attachment = {dataBuffer: originalCsv, fileExtension: "csv"}

  baseReq.formParams = {
    dataSourceCompositeId: "111::222::333",
    dataSourceSchema: "new_header_1,new_header_2",
    deleteOtherFiles: opts.deleteOtherFiles,
  }

  baseReq.params = {
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
