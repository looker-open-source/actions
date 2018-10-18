import {Action} from "./action"
import {ActionRequest} from "./action_request"
import {ActionResponse} from "./action_response"

/**
 * This type of action sends the data payload url through to the
 * remote service, rather than loading and processing the data directly inside
 * the action hub.
 *
 * This class abstracts this concept away a little bit to make it easier to set this up.
 */
export abstract class UrlPassthroughAction extends Action {

  // These actions must specify useStreaming to force Looker to send us a URL
  // rather than the data directly.
  usesStreaming = true

  // Earlier versions of Looker would sometimes send you the data directly even
  // if a streaming URL was requested.
  minimumSupportedLookerVersion = "5.24.0"

  async execute(request: ActionRequest) {
    return this.executeUrlPassthrough(request.scheduledPlan!.downloadUrl!, request)
  }

  protected abstract executeUrlPassthrough(downloadUrl: string, request: ActionRequest): Promise<ActionResponse>

}
