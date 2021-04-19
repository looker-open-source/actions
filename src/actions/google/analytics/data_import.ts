import * as winston from "winston"
import * as Hub from "../../../hub"
import { MissingAuthError } from "../common/missing_auth_error"
import { GoogleOAuthHelper, UseGoogleOAuthHelper } from "../common/oauth_helper"
import { WrappedResponse } from "../common/wrapped_response"
import { GoogleAnalyticsActionWorker } from "./lib/ga_worker"

const LOG_PREFIX = "[GA Data Import]"

export class GoogleAnalyticsDataImportAction
  extends Hub.OAuthAction
  implements UseGoogleOAuthHelper {

  /******** Action properties ********/

  readonly name = "google_analytics_data_import"
  readonly label = "Google Analytics Data Import"
  readonly iconName = "google/analytics/google_analytics_icon.svg"
  readonly description = "Upload data to a custom Data Set in Google Analytics."
  readonly supportedActionTypes = [Hub.ActionType.Query]
  readonly supportedFormats = [Hub.ActionFormat.Csv]
  readonly supportedFormattings = [Hub.ActionFormatting.Unformatted]
  readonly supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  readonly supportedDownloadSettings = [Hub.ActionDownloadSettings.Url]
  readonly usesStreaming = true
  readonly requiredFields = []
  readonly params = []

  /******** OAuth properties ********/

  readonly redirectUri = `${process.env.ACTION_HUB_BASE_URL}/actions/${encodeURIComponent(this.name)}/oauth_redirect`
  readonly oauthClientId: string
  readonly oauthClientSecret: string
  readonly oauthScopes = ["https://www.googleapis.com/auth/analytics.edit"]
  readonly oauthHelper: GoogleOAuthHelper

  /******** Constructor & some helpers ********/

  constructor(oauthClientId: string, oauthClientSecret: string) {
    super()
    this.oauthClientId = oauthClientId
    this.oauthClientSecret = oauthClientSecret
    this.oauthHelper = new GoogleOAuthHelper(this, this.makeLogger("oauth"))
  }

  makeLogger(webhookId = "") {
    return (level: string, ...rest: any[]) => {
      return winston.log(level, LOG_PREFIX, `[webhookID=${webhookId}]`, ...rest)
    }
  }

  makeOAuthClient(redirect?: string) {
    redirect = redirect ? redirect : this.redirectUri
    return this.oauthHelper.makeOAuthClient(redirect)
  }

  sanitizeError(err: any) {
    const configObjs = []
    if (err.config) {
      configObjs.push(err.config)
    }
    if (err.response && err.response.config) {
      configObjs.push(err.response.config)
    }
    for (const config of configObjs) {
      for (const prop of ["data", "body"]) {
        if (config[prop]) {
          config[prop] = "[REDACTED]"
        }
      }
    }
  }

  /******** Endpoints for Hub.OAuthAction ********/

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

  /******** Main Action Endpoints ********/

  async execute(hubReq: Hub.ActionRequest) {
    const wrappedResp = new WrappedResponse(Hub.ActionResponse)
    const log = this.makeLogger(hubReq.webhookId)

    let currentStep = "action setup"
    try {
      // The worker constructor will do a bunch of validation for us
      const gaWorker = await GoogleAnalyticsActionWorker.fromHubRequest(hubReq, this, log)

      currentStep = "Data upload step"
      await gaWorker.uploadData()
      log("info", `${currentStep} completed.`)
      log("debug", "New upload id=", gaWorker.newUploadId)

      // Since the upload was successful, update the lastUsedFormParams in user state
      gaWorker.setLastUsedFormParams()
      wrappedResp.setUserState(gaWorker.userState)

      if (gaWorker.isDeleteOtherFiles) {
        currentStep = "Delete other files step"
        await gaWorker.deleteOtherFiles()
        log("info", `${currentStep} completed.`)
      }

      // All is well if we made it this far
      log("info", "Execution completed successfully.")
      return wrappedResp.returnSuccess()
    } catch (err) {
      this.sanitizeError(err)
      log("error", "Execution error:", err.toString())
      log("error", "Exeuction errror JSON:", JSON.stringify(err))
      wrappedResp.errorPrefix = `Error during ${currentStep.toLowerCase()}: `
      return wrappedResp.returnError(err)
    }
  }

  async form(hubReq: Hub.ActionRequest) {
    const wrappedResp = new WrappedResponse(Hub.ActionForm)
    const log = this.makeLogger(hubReq.webhookId)

    try {
      const gaWorker = await GoogleAnalyticsActionWorker.fromHubRequest(hubReq, this, log)
      wrappedResp.form = await gaWorker.makeForm()
      log("info", "Form generation complete")
      return wrappedResp.returnSuccess()
      // Use this code if you need to force a state reset and redo oauth login
      // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
      // wrappedResp.resetState()
      // return wrappedResp.returnSuccess()
    } catch (err) {
      this.sanitizeError(err)
      const loginForm = await this.oauthHelper.makeLoginForm(hubReq)
      if (err instanceof MissingAuthError) {
        log("info", "Caught MissingAuthError; returning login form.")
        return loginForm
      } else {
        log("error", "Form error:", err.toString())
        log("error", "Form error JSON:", JSON.stringify(err))
        loginForm.fields[0].label =
          `Received an error (code ${err.code}) from the API, so your credentials have been discarded.`
          + " Please reauthenticate and try again."
        return loginForm
      }
    }
  }
}

/******** Register with Hub if prereqs are satisfied ********/

if (process.env.GOOGLE_ANALYTICS_CLIENT_ID && process.env.GOOGLE_ANALYTICS_CLIENT_SECRET) {
  const gadi = new GoogleAnalyticsDataImportAction(
    process.env.GOOGLE_ANALYTICS_CLIENT_ID,
    process.env.GOOGLE_ANALYTICS_CLIENT_SECRET,
  )
  Hub.addAction(gadi)
} else {
  winston.warn(`${LOG_PREFIX} Action not registered because required environment variables are missing.`)
}
