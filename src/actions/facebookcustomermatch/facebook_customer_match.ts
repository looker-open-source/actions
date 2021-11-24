import * as gaxios from "gaxios"
import * as Hub from "../../hub"

import * as querystring from "querystring"
import {URL} from "url"
import * as winston from "winston"

import FacebookCustomerMatchApi, { API_VERSION } from "./lib/api"
import FacebookCustomerMatchExecutor from "./lib/executor"
import FacebookFormBuilder from "./lib/form_builder"
import {sanitizeError} from "./lib/util"

export class FacebookCustomerMatchAction extends Hub.OAuthAction {

  readonly name = "facebook_customer_match"
  readonly label = "Facebook Customer Match"
  readonly iconName = "facebookcustomermatch/facebook_ads_icon.png"
  readonly description = "Upload data to Facebook Ads Custom Audience from Customer List"
  readonly supportedActionTypes = [Hub.ActionType.Query]
  readonly supportedFormats = [Hub.ActionFormat.JsonDetailLiteStream]
  readonly supportedFormattings = [Hub.ActionFormatting.Unformatted]
  readonly supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  readonly supportedDownloadSettings = [Hub.ActionDownloadSettings.Url]
  readonly usesStreaming = true
  readonly requiredFields = []
  readonly params = []

  readonly oauthClientId: string
  readonly oauthClientSecret: string
  readonly oauthScope: string = "read_insights,ads_management,ads_read,business_management,public_profile"

  constructor(oauthClientId: string, oauthClientSecret: string) {
    super()
    this.oauthClientId = oauthClientId
    this.oauthClientSecret = oauthClientSecret
  }

  async execute(hubRequest: Hub.ActionRequest) {
    let response = new Hub.ActionResponse()
    const accessToken = await this.getAccessTokenFromRequest(hubRequest)

    if (!accessToken) {
      response.state = new Hub.ActionState()
      response.state.data = "reset"
      response.success = false
      response.message = "Failed to execute Facebook Customer Match due to missing" +
        "authentication credentials. No data sent to Facebook. Please try again or contact support"
      return response
    }
    const executor = new FacebookCustomerMatchExecutor(hubRequest, accessToken)
    response = await executor.run()
    return response
  }

  async form(hubRequest: Hub.ActionRequest) {
    const formBuilder = new FacebookFormBuilder()
    try {
      const isAlreadyAuthenticated = await this.oauthCheck(hubRequest)
      const accessToken = await this.getAccessTokenFromRequest(hubRequest)
      if (isAlreadyAuthenticated && accessToken) {
        const facebookApi = new FacebookCustomerMatchApi(accessToken)
        const actionForm = formBuilder.generateActionForm(hubRequest, facebookApi)
        return actionForm
      }
    } catch (err) {
      sanitizeError(err)
      winston.error(err)
    }

    // Return the login form to start over if anything goes wrong during authentication or form construction
    // If a user is unauthenticated they are expected to hit an error above
    const loginForm = formBuilder.generateLoginForm(hubRequest)
    return loginForm
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {
    const url = new URL(`https://www.facebook.com/${API_VERSION}/dialog/oauth`)
    url.search = querystring.stringify({
      client_id: this.oauthClientId,
      redirect_uri: redirectUri,
      state: encryptedState,
      scope: this.oauthScope,
    })
    return url.toString()
  }

  async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string) {
    let plaintext

    try {
      const actionCrypto = new Hub.ActionCrypto()
      plaintext = await actionCrypto.decrypt(urlParams.state)
    } catch (err) {
      winston.error("Encryption not correctly configured: " + err.toString())
      throw err
    }

    const payload = JSON.parse(plaintext)

    // adding our app secret to the mix gives us a long-lived token (which lives ~60 days) instead of short-lived token
    const longLivedTokenRequestUri = `https://graph.facebook.com/${API_VERSION}` +
      `/oauth/access_token?client_id=${this.oauthClientId}&redirect_uri=${redirectUri}` +
      `&client_secret=${this.oauthClientSecret}&code=${urlParams.code}`
    const longLivedTokenResponse = await gaxios.request<any>({method: "GET", url: longLivedTokenRequestUri})

    const longLivedToken = longLivedTokenResponse.data.access_token
    const tokens = {longLivedToken}
    const userState = { tokens, redirect: redirectUri }

    // So now we use that state url to persist the oauth tokens
    try {
      await gaxios.request({
        method: "POST",
        url: payload.stateUrl,
        data: userState,
      })
    } catch (err) {
      sanitizeError(err)
      // We have seen weird behavior where Looker correctly updates the state, but returns a nonsense status code
      if (err instanceof gaxios.GaxiosError && err.response !== undefined && err.response.status < 100) {
        winston.debug("Ignoring state update response with response code <100")
      } else {
        winston.error("Error sending user state to Looker:" + (err && err.toString()))
        throw err
      }
    }
  }

  /*
    Facebook expired responses look like (in v11):
    {
      "error": {
        "message": "Error validating access token: Session has expired on Thursday,
          29-Jul-21 10:00:00 PDT. The current time is Friday, 30-Jul-21 06:41:07 PDT.",
        "type": "OAuthException",
        "code": 190,
        "error_subcode": 463,
        "fbtrace_id": "A_muLgNXB2rhzyBV_3YbJeo"
      }
    }
  */
  async oauthCheck(request: Hub.ActionRequest): Promise<boolean> {
    try {
      const accessToken = await this.getAccessTokenFromRequest(request)
      if (!accessToken) {
        winston.error("Failed oauthCheck because access token was missing or malformed")
        return false
      }
      const userDataRequestUri = `https://graph.facebook.com/${API_VERSION}/me?access_token=${accessToken}`
      const userDataResponse = await gaxios.request<any>({method: "GET", url: userDataRequestUri})
      if (userDataResponse.data.error && userDataResponse.data.error.message) {
        winston.debug("Failed oauthCheck because access token was expired or due to an error: " +
          userDataResponse.data.error.message)
        return false
      }
      return true
    } catch (err) {
      sanitizeError(err)
      winston.debug("Failed oauthCheck because access token was expired or due to an error: " + err)
      return false
    }
  }

  protected async getAccessTokenFromRequest(request: Hub.ActionRequest): Promise<string | null> {
    try {
      const params: any = request.params
      return JSON.parse(params.state_json).tokens.longLivedToken
    } catch (err) {
      winston.error("Failed to parse state for access token.")
      return null
    }
  }
}

/******** Register with Hub if prereqs are satisfied ********/

if (process.env.FACEBOOK_CLIENT_ID
  && process.env.FACEBOOK_CLIENT_SECRET
  ) {
    const fcma = new FacebookCustomerMatchAction(
      process.env.FACEBOOK_CLIENT_ID,
      process.env.FACEBOOK_CLIENT_SECRET,
    )
    Hub.addAction(fcma)
}
