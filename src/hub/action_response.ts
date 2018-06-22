export interface ValidationError {
  field: string
  message: string
}

export class ActionResponse {

  message?: string
  refreshQuery = false
  success = true
  validationErrors?: ValidationError[] = []

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
    if (this.validationErrors) {
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
      },
    }
  }

}
