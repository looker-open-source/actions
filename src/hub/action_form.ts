export class ActionForm {
  fields: ActionFormField[] = []
  error?: Error | string
  asJson(): any {
    if (this.error) {
      return {error: typeof this.error === "string" ? this.error : this.error.message}
    }
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
