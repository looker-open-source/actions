import { TokenPayload } from "."
import { ActionCrypto } from "."

import * as winston from "winston"

export class EncryptedPayload {

  static get crypto() {
    return new ActionCrypto()
  }

  static get currentCipherId() {
    return this.crypto.cipherId()
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
