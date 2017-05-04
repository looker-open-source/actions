export class DataActionForm {
  public fields: IDataActionFormField[];

  public asJson(): any {
    return this.fields;
  }

}

export interface IDataActionFormField {
  name: string;
  label?: string;
  description?: string;
  default?: string;
  type?: "string" | "textarea" | "select";
  options?: Array<{ name: string, label: string }>;
  required?: boolean;
}
