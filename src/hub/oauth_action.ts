import {Action} from "./action"
import {ActionRequest} from "./action_request"

export abstract class OAuthAction extends Action {
  abstract async oauthCheck(request: ActionRequest): Promise<boolean>
  abstract async oauthUrl(redirectUri: string, stateUrl: string, encryptedState: string): Promise<string>
  abstract async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string): Promise<string>
}

export function isOauthAction(action: Action): boolean {
  return action instanceof OAuthAction
}
