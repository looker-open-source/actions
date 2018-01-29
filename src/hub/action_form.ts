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
  type?: "string" | "textarea" | "select" | "set_params_link"
  options?: { name: string, label: string }[]
  required?: boolean
  url?: string
  settable_params?: string[]
}
