import * as winston from "winston"
import { AESTransitCrypto as ActionCrypto } from "../crypto/aes_transit_crypto"
import {Action, RouteBuilder} from "./action"
import {ActionRequest} from "./action_request"
import { EncryptedPayload } from "./encrypted_payload"

export abstract class OAuthAction extends Action {
  protected static readonly actionCrypto = new ActionCrypto()
  abstract oauthCheck(request: ActionRequest): Promise<boolean>
  abstract oauthUrl(redirectUri: string, encryptedState: string): Promise<string>
  abstract oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string): Promise<void>

  asJson(router: RouteBuilder, request: ActionRequest): any {
    const json = super.asJson(router, request)
    json.uses_oauth = true
    return json
  }

  async oauthExtractTokensFromStateJson(
    stateJson: string,
    requestWebhookId: string | undefined,
  ): Promise<any> {
    let state: any
    try {
      state = JSON.parse(stateJson)
    } catch (e: any) {
      // Outcome 1: Returns null if parsing state_json fails (e.g. malformed JSON).
      winston.error(
        `Failed to parse state_json`,
        { webhookId: requestWebhookId, action: this.name },
      )
      return null
    }

    if (state.cid && state.payload) {
      // Outcome 3: State is encrypted. Decrypt using oauthDecryptTokens.
      winston.info("Extracting encrypted state_json", { webhookId: requestWebhookId, action: this.name })
      const encryptedPayload = new EncryptedPayload(state.cid, state.payload)
      try {
        const tokenPayload = await this.oauthDecryptTokens(
          encryptedPayload,
          requestWebhookId,
        )
        return tokenPayload
      } catch (e: any) {
        // Outcome 4: Returns null if decryption fails (e.g. wrong key, tampered data).
        winston.error(
          `Failed to decrypt or parse encrypted payload: ${e.message}`,
          { webhookId: requestWebhookId, action: this.name },
        )
        return null
      }
    } else {
      // Outcome 2: State is unencrypted. Return as is.
      winston.info("Extracting unencrypted state_json", { webhookId: requestWebhookId, action: this.name })
      return state
    }
  }

  async oauthMaybeEncryptTokens(
    tokenPayload: any,
    requestWebhookId: string | undefined,
  ): Promise<EncryptedPayload | string> {
    // Generate the per-action environment variable name
    // e.g. "salesforce_campaigns" -> "ENCRYPT_PAYLOAD_SALESFORCE_CAMPAIGNS"
    const envVarName = `ENCRYPT_PAYLOAD_${this.name.toUpperCase()}`
    const perActionEncryptionValue = process.env[envVarName]

    // Check per-action variable. Default to false if not set.
    // We explicitly do NOT fallback to ENCRYPT_PAYLOAD as that is reserved for Google Drive.
    const shouldEncrypt = perActionEncryptionValue === "true"

    if (shouldEncrypt) {
      // Outcome 1: Encryption enabled. Encrypt using actionCrypto and return EncryptedPayload.
      const encrypted = await OAuthAction.actionCrypto.encrypt(JSON.stringify(tokenPayload)).catch((err: string) => {
        winston.error("Encryption not correctly configured", { webhookId: requestWebhookId, action: this.name })
        throw err
      })
      const payload = new EncryptedPayload(
        EncryptedPayload.currentCipherId,
        encrypted,
      )
      return payload
    } else {
      // Outcome 2: Encryption disabled. Return JSON stringified payload.
      return JSON.stringify(tokenPayload)
    }
  }

  async oauthDecryptTokens(
    encryptedPayload: EncryptedPayload,
    requestWebhookId: string | undefined,
  ): Promise<Record<string, any>> {
    // This method decrypts the payload and validates the JSON shape.
    const jsonPayload = await OAuthAction.actionCrypto.decrypt(encryptedPayload.payload).catch((err: string) => {
      winston.error("Failed to decrypt state_json", { webhookId: requestWebhookId, action: this.name })
      throw err
    })

    let parsed: any
    try {
      parsed = JSON.parse(jsonPayload)
    } catch {
      throw new Error("Decrypted payload is not valid JSON")
    }
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Decrypted payload must be a JSON object")
    }
    return parsed
  }
}

export function isOauthAction(action: Action): boolean {
  return action instanceof OAuthAction
}
