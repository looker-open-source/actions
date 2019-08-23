export interface IValidationError {
  field: string
  message: string
}

export class DataActionResponse {

  message: string
  refreshQuery: boolean = false
  success: boolean = true
  validationErrors: IValidationError[] = []

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
