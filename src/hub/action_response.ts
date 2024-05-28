import {ActionState} from "./action_state"

export interface ValidationError {
  field: string
  message: string
}

export interface Error {
  /* error code associated with the error */
  http_code: number
  /* The enum version of the http_code */
  status_code: string
  /* Detailed description of error written */
  message: string
  /* where in the service the failure occurred, which action was running when it erred */
  location: string
  /* url to help page listing the errors and giving detailed information about each */
  documentation_url: string
}

export class ActionResponse {
  message?: string
  refreshQuery = false
  success = true
  validationErrors: ValidationError[] = []
  state?: ActionState
  error?: Error
  webhookId?: string

  constructor(
    fields?: {
        message?: string,
        refreshQuery?: boolean,
        success?: boolean,
        validationErrors?: ValidationError[],
        error?: Error,
        webhookId?: string,
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
        error: this.error,
        webhookId: this.webhookId,
      },
    }
  }

}
