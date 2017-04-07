export class DataActionForm {
  public fields : DataActionFormField[];

  asJson() : any {
    return {
      fields: this.fields
    };
  }

}

export interface DataActionFormField {
  name : string;
  label ?: string;
  description ?: string;
  type ?: "string" | "textarea" | "select";
  options ?: { name: string, label: string }[];
  required ?: boolean,
}
