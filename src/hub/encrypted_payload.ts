import { TokenPayload } from "."
import { AESTransitCrypto as ActionCrypto } from "../crypto/aes_transit_crypto"

import * as winston from "winston"

export class EncryptedPayload {

  static get crypto() {
    return EncryptedPayload.actionCrypto
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

  private static readonly actionCrypto = new ActionCrypto()

  constructor(public cid: string, public payload: string) {}

  async decrypt(webhookId: string | undefined): Promise<TokenPayload> {
    const jsonPayload = await EncryptedPayload.crypto.decrypt(this.payload).catch((err: string) => {
      winston.error("Failed to decrypt state_json", { webhookId })
      throw err
    })
    let tokenPayload: any
    try {
      tokenPayload = JSON.parse(jsonPayload)
    } catch {
      throw new Error("Decrypted payload is not valid JSON")
    }
    if (typeof tokenPayload !== "object" || tokenPayload === null) {
      throw new Error("Decrypted payload must be a JSON object")
    }
    return tokenPayload as TokenPayload
  }

  asJson(): any {
    return {
      cid: this.cid,
      payload: this.payload,
    }
  }
}
