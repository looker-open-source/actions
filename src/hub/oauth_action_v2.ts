import {Action, RouteBuilder} from "./action"
import {ActionRequest} from "./action_request"

export abstract class OAuthActionV2 extends Action {
  abstract oauthCheck(request: ActionRequest): Promise<boolean>
  abstract oauthUrl(redirectUri: string, encryptedState: string): Promise<string>
  abstract oauthHandleRedirect(urlParams: { [key: string]: string }, redirectUri: string): Promise<string>
  abstract oauthFetchAccessToken(request: ActionRequest): Promise<string>

  asJson(router: RouteBuilder, request: ActionRequest): any {
    const json = super.asJson(router, request)
    json.uses_oauth = true
    json.token_url = router.tokenUrl(this)
    return json
  }
}

export function isOauthActionV2(action: Action): boolean {
  return action instanceof OAuthActionV2
}
