export class DataActionForm {
  public fields : DataActionFormField[];

  asJson() : any {
    return {
    };
  }

}

export class DataActionFormField {
  public name : string;
  public label : string;
}
