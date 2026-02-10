import { TokenPayload } from "."
import { ActionCrypto } from "."

import * as winston from "winston"

export class EncryptedPayload {

  static get crypto() {
    if (this._crypto === undefined) {
      this._crypto = new ActionCrypto()
    }
    return this._crypto
  }

  static get currentCipherId() {
    if (this._currentCipherId === undefined) {
      this._currentCipherId = this.crypto.cipherId()
    }
    return this._currentCipherId
  }

  static async encrypt(
    tokenPayload: TokenPayload,
    webhookId: string | undefined,
  ): Promise<EncryptedPayload> {
    const jsonPayload = JSON.stringify(tokenPayload.asJson())
    const encrypted = await this.crypto.encrypt(jsonPayload).catch((err: string) => {
      winston.error("Encryption not correctly configured", { webhookId })
      throw err
    })
    return new EncryptedPayload(this.currentCipherId, encrypted)
  }
  private static _crypto: ActionCrypto | undefined = undefined
  private static _currentCipherId: string | undefined = undefined

  constructor(public cid: string, public payload: string) {}

  async decrypt(webhookId: string | undefined): Promise<TokenPayload> {
    const jsonPayload = await EncryptedPayload.crypto.decrypt(this.payload).catch((err: string) => {
      winston.error("Failed to decrypt state_json", { webhookId })
      throw err
    })
    const tokenPayload: TokenPayload = JSON.parse(jsonPayload)
    return tokenPayload
  }

  asJson(): any {
    return {
      cid: this.cid,
      payload: this.payload,
    }
  }
}
