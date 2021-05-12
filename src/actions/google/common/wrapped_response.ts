import * as Hub from "../../../hub"
import { MissingAuthError } from "./missing_auth_error"

type HubTypes = Hub.ActionResponse | Hub.ActionForm

export class WrappedResponse<T extends HubTypes> {
  errorPrefix = ""
  private _hubResp: T

  constructor(klass: new () => T) {
    this._hubResp = new klass()
  }

  set form(form: T) {
    this._hubResp = form
  }

  returnError(err: Error) {
    if (err instanceof MissingAuthError) {
      this.resetState()
    }
    this.setError(err)
    return this._hubResp
  }

  returnSuccess(userState?: any) {
    if (userState) {
      this.setUserState(userState)
    }
    return this._hubResp
  }

  setError(err: Error) {
    if (this._hubResp instanceof Hub.ActionResponse) {
      this._hubResp.success = false
      this._hubResp.message = this.errorPrefix + err.toString()
    } else if (this._hubResp instanceof Hub.ActionForm) {
      err.message = this.errorPrefix + err.message
      this._hubResp.error = err
    }
  }

  resetState() {
    this._hubResp.state = new Hub.ActionState()
    this._hubResp.state.data = "reset"
  }

  setUserState(userState: any) {
    this._hubResp.state = new Hub.ActionState()
    this._hubResp.state.data = JSON.stringify(userState)
  }
}
