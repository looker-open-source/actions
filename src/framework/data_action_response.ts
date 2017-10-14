export interface IValidationError {
  field: string
  message: string
}

export class DataActionResponse {

  message: string
  refreshQuery: boolean = false
  success: boolean = true
  validationErrors: IValidationError[] = []

  constructor(
    fields?: {
        message?: string,
        refreshQuery?: boolean,
        success?: boolean,
        validationErrors?: IValidationError[],
    }) {
    if (fields) {
      Object.assign(this, fields)
    }
  }

  asJson(): any {
    const errs: any = {}
    for (const error of (this.validationErrors || [])) {
      errs[error.field] = error.message
    }
    return {
      message: this.message,
      refresh_query: this.refreshQuery,
      success: this.success,
      validation_errors: errs,
    }
  }

}
