import * as gaxios from "gaxios"
import * as jsforce from "jsforce"
import * as querystring from "querystring"
import * as winston from "winston"
import * as Hub from "../../../hub"
import { REDIRECT_URL, Tokens } from "../campaigns/salesforce_campaigns"

export class SalesforceOauthHelper {
  readonly oauthCreds: { oauthClientId: string; oauthClientSecret: string }

  constructor(oauthClientId: string, oauthClientSecret: string) {
    this.oauthCreds = { oauthClientId, oauthClientSecret }
  }

  async makeLoginForm(request: Hub.ActionRequest) {
    // Step 0 in the outh flow - generate an *ActionHub* url that user can visit to kick things off
    const payloadString = JSON.stringify({
      stateUrl: request.params.state_url,
      salesforce_domain: request.params.salesforce_domain,
      salesforceClientId: this.oauthCreds.oauthClientId,
    })

    //  Payload is encrypted to keep things private and prevent tampering
    let encryptedPayload
    try {
      const actionCrypto = new Hub.ActionCrypto()
      encryptedPayload = await actionCrypto.encrypt(payloadString)
    } catch (e: any) {
      winston.error("Payload encryption error:" + e.toString())
      throw e
    }

    // Step 1 in the oauth flow - user clicks the button in the form and visits the AH url generated here.
    // That response will be auto handled by the AH server as a redirect to the result of oauthUrl function below.
    const startAuthUrl = `${process.env.ACTION_HUB_BASE_URL}/actions/salesforce_campaigns/oauth?state=${encryptedPayload}`

    winston.debug("login form has startAuthUrl=", startAuthUrl)

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

    return form
  }

  /******** Handlers for Hub.OAuthAction endpoints ********/

  // actions.looker.com/actions/salesforce_campaigns/oauth
  async oauthUrl(redirectUri: string, encryptedPayload: string) {
    // Step 2 of the oauth flow - user will be sent to this Salesforce url to consent to the login.
    // `redirectUri` in this case is the AH url to which Salesforce will send them *back*, along with an auth code.
    // Note the "payload" is what we generated in loginForm above and will just be passed back to us.

    winston.debug(`beginning oauth flow with redirect url: ${redirectUri}`)

    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto
      .decrypt(encryptedPayload)
      .catch((err: string) => {
        winston.error("Encryption not correctly configured" + err)
        throw err
      })

    const payload = JSON.parse(plaintext)
    const authorizeUrl = `${payload.salesforce_domain}/services/oauth2/authorize`
    const url = new URL(authorizeUrl)
    url.search = querystring.stringify({
      response_type: "code",
      client_id: payload.salesforceClientId,
      redirect_uri: redirectUri,
      state: encryptedPayload,
    })

    // example url: https://login.salesforce.com/services/oauth2/authorize
    // ?client_id=xyz&redirect_uri=REDIRECT_URL&response_type="code"
    winston.debug(`generated Salesforce auth url: ${url}`)

    return url.toString()
  }

  // actions.looker.com/actions/salesforce_campaigns/oauth_redirect
  async oauthFetchInfo(
    urlParams: { [key: string]: string },
    redirectUri: string,
  ) {
    // Step 3 (final!) of the oauth flow
    // This method is called after Salesforce sends the user back to us.

    // Request url contains the encrypted payload we sent at the start.
    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto
      .decrypt(urlParams.state)
      .catch((e: string) => {
        winston.error("Encryption not correctly configured" + e.toString())
        throw e
      })

    const payload = JSON.parse(plaintext)

    // set auth code and redirect url in the Looker instance state by hitting
    // the one-time use link for the specific user of this action
    try {
      await gaxios.request({
        method: "POST",
        url: payload.stateUrl,
        data: { code: urlParams.code, redirect: redirectUri },
      })
    } catch (e: any) {
      // We have seen weird behavior where Looker correctly updates the state, but returns a nonsense status code
      if (
        e instanceof gaxios.GaxiosError &&
        e.response !== undefined &&
        e.response.status < 100
      ) {
        winston.debug("Ignoring state update response with response code <100")
      } else {
        winston.debug("Error sending user state to Looker: " + e.toString())
        throw e
      }
    }
  }

  async getAccessTokensFromAuthCode(stateJson: any) {
    if (!stateJson.code || !stateJson.redirect) {
      throw new Error("Request state is missing code and redirect")
    }

    const oauth2 = new jsforce.OAuth2({
      clientId: this.oauthCreds.oauthClientId,
      clientSecret: this.oauthCreds.oauthClientSecret,
      redirectUri: stateJson.redirect,
    })

    const sfdcConn = new jsforce.Connection({ oauth2 })

    await sfdcConn.authorize(stateJson.code).catch((e) => {
      winston.error(e.toString())
      throw e
    })

    return {
      access_token: sfdcConn.accessToken,
      refresh_token: sfdcConn.refreshToken!,
    }
  }
}

/******** function to create jsforce connection used in formBuilder and sendData ********/

// login with oauth2 flow
export const sfdcConnFromRequest = async (
  request: Hub.ActionRequest,
  tokens: Tokens,
  oauthCreds: { oauthClientId: string; oauthClientSecret: string },
) => {
  const oauth2 = new jsforce.OAuth2({
    clientId: oauthCreds.oauthClientId,
    clientSecret: oauthCreds.oauthClientSecret,
    redirectUri: REDIRECT_URL,
  })

  const sfdcConn = new jsforce.Connection({
    oauth2,
    instanceUrl: request.params.salesforce_domain,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  })

  return sfdcConn
}

// login with username, password + security_token (deprecated - action is using oauth)
export const salesforceLogin = async (request: Hub.ActionRequest) => {
  const sfdcConn = new jsforce.Connection({
    loginUrl: request.params.salesforce_domain!,
  })

  await sfdcConn
    .login(
      request.params.salesforce_username!,
      request.params.salesforce_password! +
        request.params.salesforce_security_token!,
    )
    .catch((e) => {
      throw e
    })

  return sfdcConn
}
