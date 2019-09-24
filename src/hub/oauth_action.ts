import {Action, RouteBuilder} from "./action"
import {ActionRequest} from "./action_request"

export abstract class OAuthAction extends Action {
  abstract async oauthCheck(request: ActionRequest): Promise<boolean>
  abstract async oauthUrl(redirectUri: string, encryptedState: string): Promise<string>
  abstract async oauthFetchInfo(urlParams: { [key: string]: string }, redirectUri: string): Promise<void>

  asJson(router: RouteBuilder, request: ActionRequest): any {
    const json = super.asJson(router, request)
    json.uses_oauth = true
    return json
  }
}

export function isOauthAction(action: Action): boolean {
  return action instanceof OAuthAction
}
