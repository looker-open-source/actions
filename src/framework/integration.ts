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

  action?(request: DataActionRequest): Promise<DataActionResponse>
  streamingAction?(request: DataActionRequest): Promise<DataActionResponse>
  form?(request: DataActionRequest): Promise<DataActionForm>

  asJson(): any {
    return {
      description: this.description,
      form_url: this.formUri,
      label: this.label,
      name: this.name,
      params: this.params,
      required_fields: this.requiredFields,
      supported_action_types: this.supportedActionTypes,
      supported_formats: this.supportedFormats,
      supported_formattings: this.supportedFormattings,
      supported_visualization_formattings: this.supportedVisualizationFormattings,
      icon_data_uri: this.imageDataUri,
      url: this.actionUri,
    }
  }

  async validateAndPerformAction(request: DataActionRequest): Promise<DataActionResponse> {
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

    if (this.hasAction) { return this.action!(request) }
    if (this.hasStreamingAction) { return this.action!(request) }

    throw `Action is not implemeted`
  }

  async validateAndFetchForm(request: DataActionRequest): Promise<DataActionForm> {
    return this.form!(request)
  }

  get hasAction(): boolean {
    return !!this.action
  }

  get hasStreamingAction(): boolean {
    return !!this.streamingAction
  }

  get hasForm(): boolean {
    return !!this.form
  }

  private get formUri(): (string|null) {
    if (this.form) {
      return Server.absUrl(`/integrations/${encodeURIComponent(this.name)}/form`)
    }

    return null
  }

  private get actionUri(): (string|null) {
    if (this.hasAction) {
      return Server.absUrl(`/integrations/${encodeURIComponent(this.name)}/action`)
    }

    if (this.hasStreamingAction) {
      return Server.absUrl(`/integrations/${encodeURIComponent(this.name)}/streamingAction`)
    }

    return null
  }

  private get imageDataUri(): (string|null) {
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
