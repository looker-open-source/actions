import * as winston from "winston"
import { AESTransitCrypto as ActionCrypto } from "../crypto/aes_transit_crypto"
import { Action, RouteBuilder } from "./action"
import { ActionRequest } from "./action_request"
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

  /**
   * Extracts token state from a JSON string.
   * - If parsing fails, returns null.
   * - If encryption markers are present, attempts to decrypt.
   * - Otherwise, returns the unencrypted JSON object.
   */
  async oauthExtractTokensFromStateJson(
    stateJson: string,
    requestWebhookId: string | undefined,
  ): Promise<any> {
    // Looker sends the literal string "reset" to clear action state.
    // We check for it explicitly here to prevent JSON parsing failures
    // and avoid spamming the logs with SyntaxErrors for a valid protocol state.
    if (stateJson === "reset") {
      winston.info("State is reset, ignoring tokens", { webhookId: requestWebhookId, action: this.name })
      return null
    }
    let state: any
    try {
      state = JSON.parse(stateJson)
    } catch (e: any) {
      winston.error(
        `Failed to parse state_json`,
        { webhookId: requestWebhookId, action: this.name },
      )
      return null
    }

    if (!state.cid || !state.payload) {
      winston.info("Extracting unencrypted state_json", { webhookId: requestWebhookId, action: this.name })
      return state
    }

    winston.info("Extracting encrypted state_json", { webhookId: requestWebhookId, action: this.name })
    const encryptedPayload = new EncryptedPayload(state.cid, state.payload)
    try {
      return await this.oauthDecryptTokens(encryptedPayload, requestWebhookId)
    } catch (e: any) {
      winston.error(
        `Failed to decrypt or parse encrypted payload: ${e.message}`,
        { webhookId: requestWebhookId, action: this.name },
      )
      return null
    }
  }

  /**
   * Conditionally encrypts token payloads based on the per-action environment config.
   * - If `ENCRYPT_PAYLOAD_<ACTION_NAME>` is "true", returns an EncryptedPayload.
   * - Otherwise, returns a standard stringified JSON payload.
   */
  async oauthMaybeEncryptTokens(
    tokenPayload: any,
    requestWebhookId: string | undefined,
  ): Promise<EncryptedPayload | string> {
    const envVarName = `ENCRYPT_PAYLOAD_${this.name.toUpperCase()}`
    const perActionEncryptionValue = process.env[envVarName]

    if (perActionEncryptionValue !== "true") {
      return JSON.stringify(tokenPayload)
    }

    const encrypted = await OAuthAction.actionCrypto.encrypt(JSON.stringify(tokenPayload)).catch((err: string) => {
      winston.error("Encryption not correctly configured", { webhookId: requestWebhookId, action: this.name })
      throw err
    })

    return new EncryptedPayload(
      EncryptedPayload.currentCipherId,
      encrypted,
    )
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
