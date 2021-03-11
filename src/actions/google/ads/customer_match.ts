import * as winston from "winston"
import * as Hub from "../../../hub"
import { MissingAuthError } from "../common/missing_auth_error"
import { GoogleOAuthHelper, UseGoogleOAuthHelper } from "../common/oauth_helper"
import { WrappedResponse } from "../common/wrapped_response"
import { GoogleAdsActionWorker } from "./lib/ads_worker"

const LOG_PREFIX = "[G Ads Customer Match]"

export class GoogleAdsCustomerMatch
  extends Hub.OAuthAction
  implements UseGoogleOAuthHelper {

  /******** Core action properties ********/

  readonly name = "google_ads_customer_match"
  readonly label = "Google Ads Customer Match"
  readonly iconName = "google/ads/google_ads_icon.svg"
  readonly description = "Upload data to Google Ads Customer Match."
  readonly supportedActionTypes = [Hub.ActionType.Query]
  readonly supportedFormats = [Hub.ActionFormat.JsonLabel]
  readonly supportedFormattings = [Hub.ActionFormatting.Unformatted]
  readonly supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  readonly supportedDownloadSettings = [Hub.ActionDownloadSettings.Url]
  readonly usesStreaming = true
  readonly requiredFields = []
  readonly params = [
    {name: "clientCid", label: "Client Account ID (CID)", required: true, sensitive: false},
  ]

  /******** Other fields + OAuth stuff ********/

  readonly redirectUri = `${process.env.ACTION_HUB_BASE_URL}/actions/${encodeURIComponent(this.name)}/oauth_redirect`
  readonly managerCid: string
  readonly developerToken: string
  readonly oauthClientId: string
  readonly oauthClientSecret: string
  readonly oauthScopes = [
    "https://www.googleapis.com/auth/adwords",
  ]
  readonly oauthHelper: GoogleOAuthHelper

  /******** Constructor & Helpers ********/

  constructor(managerCid: string, developerToken: string,  oauthClientId: string, oauthClientSecret: string) {
    super()
    this.managerCid = managerCid
    this.developerToken = developerToken
    this.oauthClientId = oauthClientId
    this.oauthClientSecret = oauthClientSecret
    this.oauthHelper = new GoogleOAuthHelper(this)
  }

  log(level: string, ...rest: any[]) {
    return winston.log(level, LOG_PREFIX, ...rest)
  }

  makeOAuthClient() {
    return this.oauthHelper.makeOAuthClient(this.redirectUri)
  }

  /******** OAuth Endpoints ********/

  async oauthUrl(redirectUri: string, encryptedState: string) {
    return this.oauthHelper.oauthUrl(redirectUri, encryptedState)
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    return this.oauthHelper.oauthFetchInfo(urlParams, redirectUri)
  }

  async oauthCheck(_request: Hub.ActionRequest) {
    // This part of Hub.OAuthAction is deprecated and unused
    return true
  }

  /******** Action Endpoints ********/

  async execute(hubReq: Hub.ActionRequest) {
    const wrappedResp = new WrappedResponse(Hub.ActionResponse)

    try {
      // The worker constructor will do a bunch of validation for us
      const adsWorker = await GoogleAdsActionWorker.fromHub(hubReq, this)

      // 1) Create a new list if requested. If not, make sure the given name exists.
      await adsWorker.getOrCreateUserList()

      // 2) Create a data job for the user list
      await adsWorker.createDataJob()

      // 3) Add the data ("user identifiers") to the job
      await adsWorker.uploadData()

      // 4) Run the job
      await adsWorker.runJob()

      // 5) TODO: should we hang around and poll the job status?

      // Success
      this.log("info", "Execution complete")
      return wrappedResp.returnSuccess(adsWorker.userState)

    } catch (err) {
      this.log("error", err.stack)
      return wrappedResp.returnError(err)
    }
  }

  async form(hubReq: Hub.ActionRequest) {
    const wrappedResp = new WrappedResponse(Hub.ActionForm)
    try {
      const adsWorker = await GoogleAdsActionWorker.fromHub(hubReq, this)
      wrappedResp.form = await adsWorker.makeForm()
      return wrappedResp.returnSuccess(adsWorker.userState)
      // Use this code if you need to force a state reset and redo oauth login
      // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
      // wrappedResp.resetState()
      // return wrappedResp.returnSuccess()
    } catch (err) {
      if (err instanceof MissingAuthError) {
        this.log("info", "Caught MissingAuthError; returning login form.")
        const loginForm = await this.oauthHelper.makeLoginForm(hubReq)
        return loginForm
      } else {
        this.log("error", err.stack)
        return wrappedResp.returnError(err)
      }
    }
  }

}

/******** Register with Hub if prereqs are satisfied ********/

if (process.env.GOOGLE_ADS_CLIENT_ID
  && process.env.GOOGLE_ADS_CLIENT_SECRET
  && process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  && process.env.GOOGLE_ADS_MANAGER_CID
  ) {
    const gacm = new GoogleAdsCustomerMatch(
      process.env.GOOGLE_ADS_MANAGER_CID,
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      process.env.GOOGLE_ADS_CLIENT_ID,
      process.env.GOOGLE_ADS_CLIENT_SECRET,
    )
    Hub.addAction(gacm)
} else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`)
}
