import { TokenPayload } from "../../../hub"

export class DriveTokens extends TokenPayload {

  static fromJson(json: any): DriveTokens {
    return new DriveTokens(json.tokens, json.redirect)
  }

  constructor(public tokens: any, public redirect: string) {
    super()
  }

  asJson(): any {
    return {
      tokens: this.tokens,
      redirect: this.redirect,
    }
  }
}
