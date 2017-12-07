export class ActionForm {
  fields: ActionFormField[]
  asJson(): any {
    return this.fields
  }
}

export interface ActionFormField {
  name: string
  label?: string
  description?: string
  default?: string
  type?: "string" | "textarea" | "select"
  options?: { name: string, label: string }[]
  required?: boolean
}
