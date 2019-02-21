import {ActionState} from "./action_state"

export class ActionForm {
  fields: ActionFormField[] = []
  state?: ActionState
  error?: Error | string
  asJson(): any {
    if (this.error) {
      return {error: typeof this.error === "string" ? this.error : this.error.message}
    }
    return {
      fields: this.fields,
      state: this.state,
    }
  }
}

export interface ActionFormField {
  name: string
  label?: string
  description?: string
  default?: string
  type?: "string" | "textarea" | "select" | "oauth_link"
  options?: { name: string, label: string }[]
  required?: boolean
  oauth_url?: string
}
