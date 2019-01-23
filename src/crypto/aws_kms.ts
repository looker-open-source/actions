import * as AWS from "aws-sdk"
import * as b64 from "base64-url"
import * as winston from "winston"
import {CryptoBase} from "./crypto_base"

export class AwsKms extends CryptoBase {
  async encrypt(plaintext: string) {
    if (process.env.KMS_KEY_ID === undefined) {
      throw "No KMS_KEY_ID present"
    }
    const kms = new AWS.KMS()
    const params = {
      KeyId: process.env.KMS_KEY_ID,
      Plaintext: plaintext,
      EncryptionContext: { looker: "actionhub" },
    }

    return new Promise<string>((resolve, reject) => {
      kms.encrypt(params, ((err, data) => {
        if ((err as any) != null) {
          winston.warn(`Encryption Error: ${err}`)
          reject(err)
        }
        if ((data as any) != null && data.CiphertextBlob) {
          resolve(b64.escape((data.CiphertextBlob as Buffer).toString("base64")))
        }
        reject("CiphertextBlob was empty")
      }))
    })
  }

  async decrypt(ciphertext: string) {
    const kms = new AWS.KMS()
    const params = {
      CiphertextBlob: Buffer.from(b64.unescape(ciphertext), "base64"),
      EncryptionContext: { looker: "actionhub" },
    }
    return new Promise<string>((resolve, reject) => {
      kms.decrypt(params, ((err, data) => {
        if ((err as any) != null) {
          winston.warn(`Decryption Error: ${err}`)
          reject(err)
        }
        if ((data as any) != null && data.Plaintext) {
          resolve(data.Plaintext.toString())
        }
        reject("Plaintext was empty")
      }))
    })
  }
}

if (process.env.KMS_PROFILE !== undefined) {
  const creds = new AWS.SharedIniFileCredentials({profile: process.env.KMS_PROFILE})
  AWS.config.update({ region: "us-east-1", credentials: creds})
}
