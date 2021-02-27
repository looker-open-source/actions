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
    this.oauthHelper = new GoogleOAuthHelper(this)
  }

  log(level: string, ...rest: any[]) {
    return winston.log(level, LOG_PREFIX, ...rest)
  }

  makeOAuthClient(redirect?: string) {
    redirect = redirect ? redirect : this.redirectUri
    return this.oauthHelper.makeOAuthClient(redirect)
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

    let currentStep = "action setup"
    try {
      // The worker constructor will do a bunch of validation for us
      const gaWorker = await GoogleAnalyticsActionWorker.fromHubRequest(hubReq, this)

      currentStep = "Data upload step"
      await gaWorker.uploadData()
      this.log("info", `${currentStep} completed.`)
      this.log("debug", "New upload id=", gaWorker.newUploadId)

      // Since the upload was successful, update the lastUsedFormParams in user state
      gaWorker.setLastUsedFormParams()
      wrappedResp.setUserState(gaWorker.userState)

      if (gaWorker.isDeleteOtherFiles) {
        currentStep = "Delete other files step"
        await gaWorker.deleteOtherFiles()
        this.log("info", `${currentStep} completed.`)
      }

      // All is well if we made it this far
      this.log("info", "Execution completed successfully.")
      return wrappedResp.returnSuccess()
    } catch (err) {
      this.log("error", err.stack)
      wrappedResp.errorPrefix = `Error during ${currentStep.toLowerCase()}: `
      return wrappedResp.returnError(err)
    }
  }

  async form(hubReq: Hub.ActionRequest) {
    const wrappedResp = new WrappedResponse(Hub.ActionForm)

    try {
      const gaWorker = await GoogleAnalyticsActionWorker.fromHubRequest(hubReq, this)
      wrappedResp.form = await gaWorker.makeForm()
      this.log("info", "Form generation complete")
      return wrappedResp.returnSuccess()
      // Use this code if you need to force a state reset and redo oauth login
      // wrappedResp.form = await this.oauthHelper.makeLoginForm(hubReq)
      // wrappedResp.resetState()
      // return wrappedResp.returnSuccess()
    } catch (err) {
      if (err instanceof MissingAuthError) {
        this.log("info", "Caught MissingAuthError; returning login form.")
        return await this.oauthHelper.makeLoginForm(hubReq)
      } else if (err.code !== undefined && err.code === "401") {
        this.log("error", "Caught a 401 error from the API; resetting user state.")
        const resp = await this.oauthHelper.makeLoginForm(hubReq)
        resp.fields[0].label =
          "Received an authentication error from the API, so your GA credentials have been discarded."
          + " Please reauthenticate to GA and try again."
        return resp
      } else {
        this.log("error", err.stack)
        wrappedResp.errorPrefix = "Form generation failed: "
        return wrappedResp.returnError(err)
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
