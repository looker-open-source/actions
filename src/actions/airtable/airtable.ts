import * as Hub from "../../hub"

import * as crypto from "crypto"
import * as gaxios from "gaxios"
import * as qs from "qs"
import * as winston from "winston"
import {ActionResponse, ActionState} from "../../hub"

const airtable: any = require("airtable")

export class AirtableAction extends Hub.OAuthAction {

  name = "airtable"
  label = "Airtable"
  iconName = "airtable/airtable.png"
  description = "Add records to an Airtable table."
  params = []
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  SCOPE = "data.records:write schema.bases:read schema.bases:write"

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json."
    }

    if (!(request.formParams.base && request.formParams.table)) {
      throw "Missing Airtable base or table."
    }

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }

    const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
    const fieldMap: any = {}
    for (const field of fields) {
      fieldMap[field.name] = field.label_short || field.label || field.name
    }
    const records = qr.data.map((row: any) => {
      const record: any = {}
      for (const field of fields) {
        record[fieldMap[field.name]] = row[field.name].value
      }
      return record
    })

    const response = new ActionResponse({success: true})
    const state = new ActionState()
    try {
      let accessToken
      if (request.params.state_json) {
        const stateJson = JSON.parse(request.params.state_json)
        const refreshResponse = await this.refreshTokens(stateJson.tokens.refresh_token)
        accessToken = (refreshResponse as any).data.access_token
        // Every single access_token invalidates previous refresh_token. Need to
        // update state on EVERY request
        state.data = JSON.stringify({
          tokens: {
            refresh_token: (refreshResponse as any).data.refresh_token,
            access_token: accessToken,
          },
        })
      }
      const airtableClient = await this.airtableClientFromRequest(accessToken)
      const base = airtableClient.base(request.formParams.base)
      const table = base(request.formParams.table)

      await Promise.all(records.map(async (record: any) => {
        return new Promise<void>((resolve, reject) => {
          table.create(record, (err: { message: string } | null, rec: any) => {
            if (err) {
              reject(err)
            } else {
              resolve(rec)
            }
          })
        })
      }))
    } catch (e: any) {
      response.success = false
      response.message = e.message
    }
    response.state = state
    return new Hub.ActionResponse(response)
  }

  async checkBaseList(token: string) {
    return gaxios.request({
      method: "GET",
      url: "https://api.airtable.com/v0/meta/bases",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch((_err) => {
      throw "Error listing bases, oauth credentials most likely expired."
    })
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    try {
      let accessToken
      if (request.params.state_json) {
        const stateJson = JSON.parse(request.params.state_json)
        const refreshResponse = await this.refreshTokens(stateJson.tokens.refresh_token)
        accessToken = (refreshResponse as any).data.access_token
        // Every single access_token invalidates previous refresh_token. Need to
        // update state on EVERY request
        form.state = new ActionState()
        form.state.data = JSON.stringify({tokens: {
            refresh_token: (refreshResponse as any).data.refresh_token,
            access_token: accessToken,
          }})
      }
      await this.checkBaseList(accessToken)
      form.fields = [{
        label: "Airtable Base",
        name: "base",
        required: true,
        type: "string",
      }, {
        label: "Airtable Table",
        name: "table",
        required: true,
        type: "string",
      }]
    } catch (e) {
      // prevents others from impersonating you
      const codeVerifier = crypto.randomBytes(96).toString("base64url") // 128 characters

      const actionCrypto = new Hub.ActionCrypto()
      const jsonString = JSON.stringify({stateurl: request.params.state_url, verifier: codeVerifier})
      const ciphertextBlob = await actionCrypto.encrypt(jsonString).catch((err: string) => {
        winston.error("Encryption not correctly configured")
        throw err
      })

      form.fields = [{
        label: "Login",
        name: "oauth",
        type: "oauth_link",
        oauth_url: `${process.env.ACTION_HUB_BASE_URL}/actions/${this.name}/oauth?state=${ciphertextBlob}`,
      }]
    }
    return form
  }

  async oauthCheck(_request: Hub.ActionRequest) {
    return false
  }

  async oauthFetchInfo(urlParams: { [p: string]: string }, redirectUri: string) {
    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })
    const payload = JSON.parse(plaintext)

    const dataString = qs.stringify({
      clientId: process.env.AIRTABLE_CLIENT_ID,
      grant_type: "authorization_code",
      code_verifier: payload.verifier,
      redirect_uri: redirectUri,
      code: urlParams.code,
    })
    const encodedCreds = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`)
        .toString("base64")
    const response = await gaxios.request({
      method: "POST",
      url: "https://www.airtable.com/oauth2/v1/token",
      headers: {
        "Authorization": `Basic ${encodedCreds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: dataString,
    })
    // Pass back context to Looker
    if (response.status === 200) {
      const data: any = response.data
      await gaxios.request({
        url: payload.stateurl,
        method: "POST",
        body: JSON.stringify({tokens: {
            refresh_token: data.refresh_token,
            access_token: data.access_token,
          }, redirect: redirectUri}),
      }).catch((_err) => { winston.error(_err.toString()) })
    } else {
      winston.warn("Oauth for Airtable unsuccessful")
      throw "OAuth did not work"
    }
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {

    const clientId = process.env.AIRTABLE_CLIENT_ID ?  process.env.AIRTABLE_CLIENT_ID : "must exist"

    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto.decrypt(encryptedState).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })
    const payload = JSON.parse(plaintext)

    // prevents others from impersonating you
    const codeVerifier = payload.verifier// 128 characters
    const codeChallengeMethod = "S256"
    const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier) // hash the code verifier with the sha256 algorithm
        .digest("base64") // base64 encode, needs to be transformed to base64url
        .replace(/=/g, "") // remove =
        .replace(/\+/g, "-") // replace + with -
        .replace(/\//g, "_") // replace / with _ now base64url encoded
    // build the authorization URL
    const authorizationUrl = new URL(`https://www.airtable.com/oauth2/v1/authorize`)
    authorizationUrl.searchParams.set("code_challenge", codeChallenge)
    authorizationUrl.searchParams.set("code_challenge_method", codeChallengeMethod)
    authorizationUrl.searchParams.set("state", encryptedState)
    authorizationUrl.searchParams.set("client_id", clientId)
    authorizationUrl.searchParams.set("redirect_uri", redirectUri)
    authorizationUrl.searchParams.set("response_type", "code")
    // your OAuth integration register with these scopes in the management page
    authorizationUrl.searchParams.set("scope", this.SCOPE)

    return authorizationUrl.toString()
  }

  private async airtableClientFromRequest(token: string) {
    return new airtable({apiKey: token})
  }

  private async refreshTokens(refreshToken: string) {
    try {
      const dataString = qs.stringify({
        client_id: process.env.AIRTABLE_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      })

      const encodedCreds = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`)
          .toString("base64")
      return await gaxios.request({
        method: "POST",
        url: "https://www.airtable.com/oauth2/v1/token",
        headers: {
          "Authorization": `Basic ${encodedCreds}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        data: dataString,
      })
    } catch (e) {
      winston.warn("Error with Airtable Access Token Refresh")
      return {data: {}}
    }
  }

}

if (process.env.AIRTABLE_CLIENT_ID && process.env.AIRTABLE_CLIENT_SECRET) {
  Hub.addAction(new AirtableAction())
}
