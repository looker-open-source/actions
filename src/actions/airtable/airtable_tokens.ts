import { TokenPayload } from "../../hub"

export class AirtableTokens extends TokenPayload {

  static fromJson(json: any): AirtableTokens {
    if (json.tokens) {
      return new AirtableTokens(json.tokens.refresh_token, json.tokens.access_token, json.redirect)
    }
    return new AirtableTokens(json.refresh_token, json.access_token, json.redirectUri)
  }

  // tslint:disable-next-line:variable-name
  refresh_token: string
  // tslint:disable-next-line:variable-name
  access_token: string
  redirectUri?: string

  constructor(refreshToken: string, accessToken: string, redirectUri?: string) {
    super()
    this.refresh_token = refreshToken
    this.access_token = accessToken
    this.redirectUri = redirectUri
  }

  asJson(): any {
    return {
      tokens: {
        refresh_token: this.refresh_token,
        access_token: this.access_token,
      },
      redirect: this.redirectUri,
    }
  }

  toJSON(): any {
    return this.asJson()
  }
}
