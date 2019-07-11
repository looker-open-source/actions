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

interface ActionFormFieldBase {
  name: string
  label?: string
  description?: string
  default?: string
  required?: boolean
}

interface ActionFormFieldString extends ActionFormFieldBase {
  type?: "string" | "textarea"
}

interface ActionFormFieldSelect extends ActionFormFieldBase {
  type: "select"
  options: { name: string, label: string }[]
}

interface ActionFormFieldOAuth extends ActionFormFieldBase {
  type: "oauth_link"
  oauth_url: string
}

interface ActionFormFieldOAuthInfo extends ActionFormFieldBase {
  type: "auth_info"
  value: string | undefined
}

export type ActionFormField = ActionFormFieldString | ActionFormFieldSelect | ActionFormFieldOAuth | ActionFormFieldOAuthInfo
