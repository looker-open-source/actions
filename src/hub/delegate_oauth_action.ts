import {Action, ActionParameter, RouteBuilder} from "./action"
import {ActionForm} from "./action_form"
import {ActionRequest} from "./action_request"

export interface DelegateOauthActionParameter extends ActionParameter {
  delegate_oauth_url: string
}

export abstract class DelegateOAuthAction extends Action {
  abstract params: DelegateOauthActionParameter[]

  abstract async oauthCheck(request: ActionRequest): Promise<ActionForm>

  asJson(router: RouteBuilder, request: ActionRequest): any {
    const json = super.asJson(router, request)
    json.uses_oauth = true
    json.delegate_oauth = true
    return json
  }
}

export function isDelegateOauthAction(action: Action): boolean {
  return action instanceof DelegateOAuthAction
}
