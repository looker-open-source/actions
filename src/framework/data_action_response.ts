export interface IValidationError {
  field: string;
  message: string;
}

export class DataActionResponse {

  public message: string;
  public refreshQuery: boolean = false;
  public success: boolean = true;
  public validationErrors: IValidationError[] = [];

  public asJson(): any {
    let errs: any = {};
    for (let error of (this.validationErrors || [])) {
      errs[error.field] = error.message;
    }
    return {
      message: this.message,
      refresh_query: this.refreshQuery,
      success: this.success,
      validation_errors: errs,
    };
  }

}
