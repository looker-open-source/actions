import * as Hub from "../../hub"

import * as crypto from "crypto"
import * as gaxios from "gaxios"
import * as qs from "qs"
import * as winston from "winston"

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

  const SCOPE = "data.records:read data.records:write"

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

    let response
    try {
      const airtableClient = this.airtableClientFromRequest(request)
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
      response = { success: false, message: e.message }
    }
    return new Hub.ActionResponse(response)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    try {
      const airtableClient = this.airtableClientFromRequest(request)
      airtableClient.list()
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
    return form
  }

  async oauthCheck(request: Hub.ActionRequest) {
    return false
  }

  async oauthFetchInfo(urlParams: { [p: string]: string }, redirectUri: string) {
    const actionCrypto = new Hub.ActionCrypto()
    const plaintext = await actionCrypto.decrypt(urlParams.state).catch((err: string) => {
      winston.error("Encryption not correctly configured" + err)
      throw err
    })
    const payload = JSON.parse(plaintext)

    // const tokens = await this.getAccessTokenCredentialsFromCode(redirectUri, urlParams.code)
    const dataString = qs.stringify({
      clientId: process.env.AIRTABLE_CLIENT_ID,
      grant_type: "authorization_code",
      code_verifier: payload.verifier,
      redirect_uri: redirectUri,
      code: urlParams.code,
    })
    // @ts-ignore
    const encodedCreds = Buffer.from(`${process.env.AIRTABLE_CLIENT_ID}:${process.env.AIRTABLE_CLIENT_SECRET}`)
        .toString("base64")
    const response = await gaxios.request({
      method: "POST",
      url: "https://www.airtable.com/oauth2/v1/token",
      headers: {
        // "Authorization": `Basic ${encodedCreds}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: dataString,
    })
    JSON.stringify(response.data)
    // Pass back context to Looker
    await gaxios.request({
      url: payload.stateurl,
      method: "POST",
      body: JSON.stringify({tokens, redirect: redirectUri}),
    }).catch((_err) => { winston.error(_err.toString()) })
  }

  async oauthUrl(redirectUri: string, encryptedState: string) {

    const clientId = process.env.AIRTABLE_CLIENT_ID || "nope"

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

  private airtableClientFromRequest(request: Hub.ActionRequest) {
    // todo: extract tokens and handle non-infinite refresh
    if (request.params.state_json) {
      const stateJson = JSON.parse(request.params.state_json)
      return new airtable({customHeaders: stateJson})
    } else {
      return null
    }
  }

}

if (process.env.AIRTABLE_CLIENT_ID && process.env.AIRTABLE_CLIENT_SECRET) {
  Hub.addAction(new AirtableAction())
}
