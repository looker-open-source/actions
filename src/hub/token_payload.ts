export abstract class TokenPayload {
  static fromJson(_json: any): TokenPayload {
    throw new Error("Not implemented: fromJson")
  }

  abstract asJson(): any
}
