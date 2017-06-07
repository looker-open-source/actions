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
}

export interface IRequiredField {
  tag?: string
  any_tag?: string[]
  all_tags?: string[]
}

export interface IIntegration {

  name: string
  label: string
  description: string
  iconName?: string

  supportedActionTypes: DataActionType[]
  supportedFormats?: DataActionFormat[]
  supportedFormattings?: Array<"formatted" | "unformatted">
  supportedVisualizationFormattings?: Array<"apply" | "noapply">
  requiredFields?: IRequiredField[]

  params: IIntegrationParameter[]

  action: (request: DataActionRequest) => Promise<DataActionResponse>
  form?: (request: DataActionRequest) => Promise<DataActionForm>

}
export class Integration {

  private integration: IIntegration

  constructor(def: IIntegration) {
    if (!def.requiredFields) {
      def.requiredFields = []
    }
    this.integration = def
  }

  get form() {
    return this.integration.form
  }

  get name() {
    return this.integration.name
  }

  get action() {
    return this.integration.action
  }

  public asJson(): any {
    return {
      description: this.integration.description,
      form_url: this.integration.form ?
          Server.absUrl(`/integrations/${encodeURIComponent(this.integration.name)}/form`)
        :
          null,
      label: this.integration.label,
      name: this.integration.name,
      params: this.integration.params,
      required_fields: this.integration.requiredFields,
      supported_action_types: this.integration.supportedActionTypes,
      supported_formats: this.integration.supportedFormats,
      supported_formattings: this.integration.supportedFormattings,
      supported_visualization_formattings: this.integration.supportedVisualizationFormattings,
      icon_data_uri: this.getImageDataUri(),
      url: this.integration.action ?
          Server.absUrl(`/integrations/${encodeURIComponent(this.integration.name)}/action`)
        :
          null,
    }
  }

  public async validateAndPerformAction(request: DataActionRequest) {

    if (this.integration.supportedActionTypes &&
      this.integration.supportedActionTypes.indexOf(request.type) === -1
    ) {
       throw `This action does not support requests of type "${request.type}".`
    }

    const requiredParams = this.integration.params.filter((p) => p.required)

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

    return this.integration.action(request)

  }

  private getImageDataUri() {
    if (!this.integration.iconName) {
      return null
    }
    const iconPath = path.resolve(__dirname, "..", "integrations", "icons", this.integration.iconName)
    if (fs.existsSync(iconPath)) {
      return new datauri(iconPath).content
    }
    return null
  }

}
