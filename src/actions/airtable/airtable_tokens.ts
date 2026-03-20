import { TokenPayload } from "../../hub"

// AirtableTokens holds the access and refresh tokens for Airtable OAuth.
// It extends TokenPayload to integrate with the Action Hub's OAuth framework.
export class AirtableTokens extends TokenPayload {

  // fromJson parses token payloads from two possible JSON shapes:
  // 1. A nested shape (`{ tokens: { access_token, refresh_token }, redirect }`) used by newer ActionHub serialization.
  // 2. A legacy flat shape (`{ access_token, refresh_token, redirectUri }`) used by older states.
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

  // asJson serializes the tokens into a standard JSON shape that ActionHub expects.
  // It matches the shape used by newer ActionHub serialization for encrypted payloads.
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
