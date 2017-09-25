import { Server } from "../server"

import { DataActionForm } from "./data_action_form"
import { DataActionFormat, DataActionRequest, DataActionType } from "./data_action_request"
import { DataActionResponse } from "./data_action_response"

import * as fs from "fs"
import * as path from "path"
const datauri = require("datauri")

export interface IIntegrationParameter {
  name: string
  label: string
  required: boolean
  sensitive: boolean
  description?: string
  default?: string
  type?: "string" | "select"
  options?: Array<{ name: string, label: string }>
}

export interface IRequiredField {
  tag?: string
  any_tag?: string[]
  all_tags?: string[]
}

export interface Integration {
  action(request: DataActionRequest): Promise<DataActionResponse>
  form?(request: DataActionRequest): Promise<DataActionForm>
}

export abstract class Integration {

  name: string
  label: string
  description: string
  iconName?: string

  supportedActionTypes: DataActionType[]
  supportedFormats?: DataActionFormat[]
  supportedFormattings?: Array<"formatted" | "unformatted">
  supportedVisualizationFormattings?: Array<"apply" | "noapply">
  requiredFields?: IRequiredField[] = []

  params: IIntegrationParameter[]

  asJson(): any {
    return {
      description: this.description,
      form_url: this.form ?
          Server.absUrl(`/integrations/${encodeURIComponent(this.name)}/form`)
        :
          null,
      label: this.label,
      name: this.name,
      params: this.params,
      required_fields: this.requiredFields,
      supported_action_types: this.supportedActionTypes,
      supported_formats: this.supportedFormats,
      supported_formattings: this.supportedFormattings,
      supported_visualization_formattings: this.supportedVisualizationFormattings,
      icon_data_uri: this.getImageDataUri(),
      url: this.action ?
          Server.absUrl(`/integrations/${encodeURIComponent(this.name)}/action`)
        :
          null,
    }
  }

  async validateAndPerformAction(request: DataActionRequest) {

    if (this.supportedActionTypes &&
      this.supportedActionTypes.indexOf(request.type) === -1
    ) {
       throw `This action does not support requests of type "${request.type}".`
    }

    const requiredParams = this.params.filter((p) => p.required)

    if (requiredParams.length > 0) {
      if (request.params) {
        for (const p of requiredParams) {
          const param = request.params[p.name]
          if (param === undefined || param === null) {
            throw `Required parameter "${p.name}" not provided.`
          }
        }
      } else {
        throw `No "params" provided but this action has required parameters.`
      }
    }

    return this.action(request)

  }

  async validateAndFetchForm(request: DataActionRequest) {
    return this.form!(request)
  }

  get hasAction() {
    return !!this.action
  }

  get hasForm() {
    return !!this.form
  }

  private getImageDataUri() {
    if (!this.iconName) {
      return null
    }
    const iconPath = path.resolve(__dirname, "..", "integrations", "icons", this.iconName)
    if (fs.existsSync(iconPath)) {
      return new datauri(iconPath).content
    }
    return null
  }

}
