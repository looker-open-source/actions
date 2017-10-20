export class DataActionForm {
  fields: IDataActionFormField[]
  asJson(): any {
    return this.fields
  }
}

export interface IDataActionFormField {
  name: string
  label?: string
  description?: string
  default?: string
  type?: "string" | "textarea" | "select"
  options?: { name: string, label: string }[]
  required?: boolean
}
