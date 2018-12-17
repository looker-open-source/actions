import * as AWS from "aws-sdk"
import * as winston from "winston"
import {CryptoBase} from "./crypto_base"

export class AwsKms extends CryptoBase {
  async encrypt(plaintext: string) {
    if (plaintext == null) {
      throw "Plaintext was empty"
    }
    if (process.env.KMS_KEY_ID == null) {
      throw "No KMS_KEY_ID present"
    }
    const kms = new AWS.KMS()
    const params = {
      KeyId: process.env.KMS_KEY_ID,
      Plaintext: plaintext,
    }

    return new Promise<string>((resolve, reject) => {
      kms.encrypt(params, ((err, data) => {
        if (err != null && err.message) {
          winston.info(`Error: ${err.message}`)
          reject(err.message)
        }
        if (data.CiphertextBlob) {
          resolve(data.CiphertextBlob.toString())
        }
        reject("CiphertextBlob was empty")
      }))
    })
  }

  async decrypt(ciphertext: string) {
    const kms = new AWS.KMS()
    const params = {
      CiphertextBlob: ciphertext,
    }

    return new Promise<string>((resolve, reject) => {
      kms.decrypt(params, ((err, data) => {
        if (err != null && err.message) {
          winston.info(`Error: ${err.message}`)
          reject(err.message)
        }
        if (data.Plaintext) {
          resolve(data.Plaintext.toString())
        }
        reject("Plaintext was empty")
      }))
    })
  }
}
