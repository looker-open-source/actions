import {ActionState} from "./action_state"

export interface ValidationError {
  field: string
  message: string
}

export class ActionResponse {

  message?: string
  refreshQuery = false
  success = true
  validationErrors: ValidationError[] = []
  state?: ActionState

  constructor(
    fields?: {
        message?: string,
        refreshQuery?: boolean,
        success?: boolean,
        validationErrors?: ValidationError[],
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
      },
    }
  }

}
