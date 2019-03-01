import * as b64 from "base64-url"
import * as crypto from "crypto"
import {CryptoProvider} from "./crypto_base"

// This class is meant for local development and will never go into production
export class LocalCryptoTesting implements CryptoProvider {
  ALGORITHM = "aes-256-cbc"
  INSECURE_IV = Buffer.alloc(16)

  async encrypt(plaintext: string) {
    if (process.env.CIPHER_PASSWORD === undefined) {
      throw "CIPHER_PASSWORD environment variable not set"
    }
    const passHash = crypto.createHash("md5").update(process.env.CIPHER_PASSWORD).digest("hex").toUpperCase()
    const cipher = crypto.createCipheriv(this.ALGORITHM, passHash, this.INSECURE_IV)
    let cipherText = cipher.update(plaintext, "utf8", "base64")
    cipherText += cipher.final("base64")
    return b64.escape(cipherText)
  }
  async decrypt(ciphertext: string) {
    if (process.env.CIPHER_PASSWORD === undefined) {
      throw "CIPHER_PASSWORD environment variable not set"
    }
    const passHash = crypto.createHash("md5").update(process.env.CIPHER_PASSWORD).digest("hex").toUpperCase()
    const cipher = crypto.createDecipheriv(this.ALGORITHM, passHash, this.INSECURE_IV)
    let cipherText = cipher.update(b64.unescape(ciphertext), "base64", "utf8")
    cipherText += cipher.final("utf8")
    return cipherText
  }
}
