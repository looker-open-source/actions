import * as winston from "winston"
import { ActionCrypto, EncryptedPayload } from "."
import {Action, RouteBuilder} from "./action"
import {ActionRequest} from "./action_request"

export abstract class OAuthAction extends Action {
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
      winston.error(
        `Failed to parse state_json`,
        { webhookId: requestWebhookId, action: this.name },
      )
      return null
    }

    if (state.cid && state.payload) {
      winston.info("Extracting encrypted state_json", { webhookId: requestWebhookId, action: this.name })
      const encryptedPayload = new EncryptedPayload(state.cid, state.payload)
      try {
        const tokenPayload = await this.oauthDecryptTokens(
          encryptedPayload,
          requestWebhookId,
        )
        return tokenPayload
      } catch (e: any) {
        winston.error(
          `Failed to decrypt or parse encrypted payload: ${e.message}`,
          { webhookId: requestWebhookId, action: this.name },
        )
        return null
      }
    } else {
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
      const encrypted = await new ActionCrypto().encrypt(JSON.stringify(tokenPayload)).catch((err: string) => {
        winston.error("Encryption not correctly configured", { webhookId: requestWebhookId, action: this.name })
        throw err
      })
      const payload = new EncryptedPayload(
        EncryptedPayload.currentCipherId,
        encrypted,
      )
      return payload
    } else {
      return JSON.stringify(tokenPayload)
    }
  }

  async oauthDecryptTokens(
    encryptedPayload: EncryptedPayload,
    requestWebhookId: string | undefined,
  ): Promise<any> {
    const actionCrypto = new ActionCrypto()
    const jsonPayload = await actionCrypto.decrypt(encryptedPayload.payload).catch((err: string) => {
      winston.error("Failed to decrypt state_json", { webhookId: requestWebhookId, action: this.name })
      throw err
    })
    return JSON.parse(jsonPayload)
  }
}

export function isOauthAction(action: Action): boolean {
  return action instanceof OAuthAction
}
