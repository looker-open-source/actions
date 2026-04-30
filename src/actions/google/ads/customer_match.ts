import * as winston from "winston"
import * as Hub from "../../../hub"
import { makeBetterErrorMessage, sanitizeError } from "../common/error_utils"
import { MissingAuthError } from "../common/missing_auth_error"
import { GoogleOAuthHelper, UseGoogleOAuthHelper } from "../common/oauth_helper"
import { WrappedResponse } from "../common/wrapped_response"
import { GoogleAdsActionRequest } from "./lib/ads_request"

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
  readonly params = []

  /******** Other fields + OAuth stuff ********/

  readonly redirectUri = `${process.env.ACTION_HUB_BASE_URL}/actions/${encodeURIComponent(this.name)}/oauth_redirect`
  readonly developerToken: string
  readonly oauthClientId: string
  readonly oauthClientSecret: string
  readonly oauthScopes = [
    "https://www.googleapis.com/auth/adwords",
  ]
  readonly oauthHelper: GoogleOAuthHelper

  /******** Constructor & Helpers ********/

  constructor(oauthClientId: string, oauthClientSecret: string, developerToken: string) {
    super()
    this.developerToken = developerToken
    this.oauthClientId = oauthClientId
    this.oauthClientSecret = oauthClientSecret
    this.oauthHelper = new GoogleOAuthHelper(this, this.makeLogger("oauth"))
  }

  makeLogger(webhookId = "") {
    return (level: string, ...rest: any[]) => {
      return winston.log(level, LOG_PREFIX, `[webhookID=${webhookId}]`, ...rest)
    }
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

  // We must override the legacy hardcoded 'true' return here.
  // Modern Looker instances optimize OAuth flows based on this check. Lying and returning
  // true when tokens are missing causes Looker to assume valid auth state, leading to
  // infinite loops during fresh logins.
  async oauthCheck(request: Hub.ActionRequest) {
    if (request.params.state_json) {
      const state = await this.oauthExtractTokensFromStateJson(request.params.state_json, request.webhookId)
      return !!(state && state.tokens && state.tokens.access_token)
    }
    return false
  }

  /******** Action Endpoints ********/

  async execute(hubReq: Hub.ActionRequest) {
    const wrappedResp = new WrappedResponse(Hub.ActionResponse)
    const log = this.makeLogger(hubReq.webhookId)
    try {
      const adsRequest = await GoogleAdsActionRequest.fromHub(hubReq, this, log)
      await adsRequest.execute()
      log("info", "Execution complete")
      const encrypted = await this.oauthMaybeEncryptTokens(adsRequest.userState, hubReq.webhookId)
      return wrappedResp.returnSuccess(encrypted)
    } catch (err: any) {
      sanitizeError(err)
      makeBetterErrorMessage(err, hubReq.webhookId)
      log("error", "Execution error toString:", err.toString())
      log("error", "Execution error JSON:", JSON.stringify(err))
      return wrappedResp.returnError(err)
    }
  }

  async form(hubReq: Hub.ActionRequest) {
    const wrappedResp = new WrappedResponse(Hub.ActionForm)
    const log = this.makeLogger(hubReq.webhookId)
    try {
      const adsWorker = await GoogleAdsActionRequest.fromHub(hubReq, this, log)
      wrappedResp.form = await adsWorker.makeForm()
      const encrypted = await this.oauthMaybeEncryptTokens(adsWorker.userState, hubReq.webhookId)
      return wrappedResp.returnSuccess(encrypted)
      // Use this code if you need to force a state reset and redo oauth login
      // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
      // wrappedResp.resetState()
      // return wrappedResp.returnSuccess()
    } catch (err: any) {
      sanitizeError(err)
      const loginForm = await this.oauthHelper.makeLoginForm(hubReq)
      // Token errors that we can detect ahead of time
      if (err instanceof MissingAuthError) {
        log("debug", "Caught MissingAuthError; returning login form.")
        return loginForm
      }
      log("error", "Form error toString:", err.toString())
      log("error", "Form error JSON:", JSON.stringify(err))

      // AuthorizationError from API client - this occurs when request contains bad loginCid or targetCid
      if (err.code === "403") {
        wrappedResp.errorPrefix = `Error loading target account with request: ${err.response.request.responseURL}. `
        + `${err.response.data[0].error.details[0].errors[0].message}`
        + ` Please retry loading the form again with the correct login account. `
        log("error", `Error loading target account with request: ${err.response.request.responseURL}. `
        + `${err.response.data[0].error.details[0].errors[0].message}`)
        return wrappedResp.returnError(err)
      }

      // Other errors from the API client - typically an auth problem
      const isAuthError =
        err.response?.status === 401 ||
        err.code === "401" ||
        err.code === 401 ||
        (err.response?.status === 400 && err.response?.data?.error === "invalid_grant")

      if (isAuthError) {
        loginForm.fields[0].label =
          `Received an authentication error from the API, so your credentials have been discarded.`
          + " Please reauthenticate and try again."
        log("error", `Received auth error from the API, credentials have been discarded.`)
        return loginForm
      }
      // All other errors
      wrappedResp.errorPrefix = "Form generation error: "
      log("error", `Form generation error, code: ${err.code}.`)
      return wrappedResp.returnError(err)
    }
  }
}

/******** Register with Hub if prereqs are satisfied ********/

if (process.env.GOOGLE_ADS_CLIENT_ID
  && process.env.GOOGLE_ADS_CLIENT_SECRET
  && process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  ) {
    const gacm = new GoogleAdsCustomerMatch(
      process.env.GOOGLE_ADS_CLIENT_ID,
      process.env.GOOGLE_ADS_CLIENT_SECRET,
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    )
    Hub.addAction(gacm)
} else {
    winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`)
}
