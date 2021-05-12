import * as winston from "winston"
import * as Hub from "../../../hub"
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

  sanitizeError(err: any) {
    const headersObjs = []
    if (err.config && err.config.headers) {
      headersObjs.push(err.config.headers)
    }
    if (err.response && err.response.config && err.response.config.headers) {
      headersObjs.push(err.response.config.headers)
    }
    for (const headers of headersObjs) {
      for (const prop of ["developer-token", "Authorization"]) {
        if (headers[prop]) {
          headers[prop] = "[REDACTED]"
        }
      }
    }
  }

  makeBetterErrorMessage(err: any) {
    let apiError: any
    let subError: any
    let errorCode: number | undefined
    let generalMessage: string | undefined
    let detailMessage: string | undefined
    let userListError: string | undefined

    if (err.response && err.response.data && err.response.data.error) {
      apiError = err.response.data.error
      if (apiError.code) {
        errorCode = apiError.code
      }
      if (apiError.message) {
        generalMessage = apiError.message
      }
      if (Array.isArray(apiError.details) && apiError.details[0] && Array.isArray(apiError.details[0].errors)) {
        subError = apiError.details[0].errors[0]
        if (subError.message) {
          detailMessage = subError.message
        }
        if (subError.errorCode && subError.errorCode.userListError) {
          userListError = subError.errorCode.userListError
        }
      }
    }

    if (userListError === "ADVERTISER_NOT_ON_ALLOWLIST_FOR_USING_UPLOADED_DATA") {
      err.name = ""
      err.message = "The target account is not enabled for data uploads (e.g. Customer Match lists)."
          + " Please visit Audience Manager in the Ads UI for further information."
      return
    }

    if (apiError) {
      err.name = "Ads API Error"
      err.message = `${errorCode} - ${generalMessage}` + (detailMessage ? ` Details: ${detailMessage}` : "")
    }
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
    const log = this.makeLogger(hubReq.webhookId)
    try {
      const adsRequest = await GoogleAdsActionRequest.fromHub(hubReq, this, log)
      await adsRequest.execute()
      log("info", "Execution complete")
      return wrappedResp.returnSuccess(adsRequest.userState)
    } catch (err) {
      this.sanitizeError(err)
      this.makeBetterErrorMessage(err)
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
      return wrappedResp.returnSuccess(adsWorker.userState)
      // Use this code if you need to force a state reset and redo oauth login
      // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
      // wrappedResp.resetState()
      // return wrappedResp.returnSuccess()
    } catch (err) {
      this.sanitizeError(err)
      const loginForm = await this.oauthHelper.makeLoginForm(hubReq)
      // Token errors that we can detect ahead of time
      if (err instanceof MissingAuthError) {
        log("info", "Caught MissingAuthError; returning login form.")
        return loginForm
      }
      log("error", "Form error toString:", err.toString())
      log("error", "Form error JSON:", JSON.stringify(err))
      // Errors from the API client - typically an auth problem
      if (err.code) {
        loginForm.fields[0].label =
          `Received error code ${err.code} from the API, so your credentials have been discarded.`
          + " Please reauthenticate and try again."
        return loginForm
      }
      // All other errors
      wrappedResp.errorPrefix = "Form generation error: "
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
