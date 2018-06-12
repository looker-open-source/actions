import {ActionState} from "./action_state"

export class ActionForm {
  fields: ActionFormField[] = []
  state?: ActionState
  asJson(): any {
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
  type?: "string" | "textarea" | "select" | "set_params_link" | "external_link"
  options?: { name: string, label: string }[]
  required?: boolean
  url?: string
  settable_params?: string[]
}
