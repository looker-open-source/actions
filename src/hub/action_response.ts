import {ActionState} from "./action_state"

export interface ValidationError {
  field: string
  message: string
}

export interface ErrorDetail {
  /* error code associated with the error */
  http_code?: number
  /* A one word description of what happened */
  reason: string
  /* Error message that was thrown */
  message: string
  /* Detailed description of error written by us */
  detail: string
  /* one of the three services it could have erred in */
  locationType: string
  /* where in the service the failure occurred, which action was running when it erred */
  location: string
  /* url to help page listing the errors and giving detailed information about each */
  help: string
}

export class ActionResponse {
  message?: string
  refreshQuery = false
  success = true
  validationErrors: ValidationError[] = []
  state?: ActionState
  errorDetail?: ErrorDetail

  constructor(
    fields?: {
        message?: string,
        refreshQuery?: boolean,
        success?: boolean,
        validationErrors?: ValidationError[],
        errorDetail?: ErrorDetail,
    }) {
    if (fields) {
      Object.assign(this, fields)
    }
  }

  asJson(): any {
    const errs: any = {}
    if (this.validationErrors.length > 0) {
      for (const error of this.validationErrors) {
        errs[error.field] = error.message
      }
    }
    return {
      looker: {
        message: this.message,
        refresh_query: this.refreshQuery,
        success: this.success,
        validation_errors: errs,
        state: this.state,
        errorDetail: this.errorDetail,
      },
    }
  }

}
