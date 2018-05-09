import * as fs from "fs"
import * as path from "path"

import {
  ActionDownloadSettings,
  ActionForm,
  ActionFormat,
  ActionFormatting,
  ActionRequest,
  ActionResponse,
  ActionType,
  ActionVisualizationFormatting,
} from "."

const datauri = require("datauri")

export interface ActionParameter {
  name: string
  label: string
  required: boolean
  sensitive: boolean
  description?: string
}

export interface RequiredField {
  tag?: string
  any_tag?: string[]
  all_tags?: string[]
}

export interface Action {
  execute(request: ActionRequest): Promise<ActionResponse>
  form?(request: ActionRequest): Promise<ActionForm>
}

export interface RouteBuilder {
  actionUrl(action: Action): string
  formUrl(action: Action): string
}

export abstract class Action {

  abstract name: string
  abstract label: string
  abstract description: string
  usesStreaming = false
  iconName?: string

  // Default to the earliest version of Looker with support for the Action API
  minimumSupportedLookerVersion = "5.5.0"

  abstract supportedActionTypes: ActionType[]
  supportedFormats?: ActionFormat[]
  supportedFormattings?: ActionFormatting[]
  supportedVisualizationFormattings?: ActionVisualizationFormatting[]
  requiredFields?: RequiredField[] = []

  abstract params: ActionParameter[]

  asJson(router: RouteBuilder) {
    return {
      description: this.description,
      form_url: this.form ? router.formUrl(this) : null,
      label: this.label,
      name: this.name,
      params: this.params,
      required_fields: this.requiredFields,
      supported_action_types: this.supportedActionTypes,
      supported_formats: this.supportedFormats,
      supported_formattings: this.supportedFormattings,
      supported_visualization_formattings: this.supportedVisualizationFormattings,
      supported_download_settings: (
        this.usesStreaming
          ?
            [ActionDownloadSettings.Url]
          :
            [ActionDownloadSettings.Push]
      ),
      icon_data_uri: this.getImageDataUri(),
      url: this.execute ? router.actionUrl(this) : null,
    }
  }

  async validateAndExecute(request: ActionRequest) {

    if (!request.type) {
      throw `Action did not specify a "type". Valid types for this action are: ${this.supportedActionTypes.join(", ")}.`
    }

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
          if (!param) {
            throw `Required parameter "${p.name}" not provided.`
          }
        }
      } else {
        throw `No "params" provided but this action has required parameters.`
      }
    }

    if (
      this.usesStreaming &&
      !(request.attachment || (request.scheduledPlan && request.scheduledPlan.downloadUrl))
    ) {
      throw "A streaming action was sent incompatible data. The action must have a download url or an attachment."
    }

    return this.execute(request)

  }

  async validateAndFetchForm(request: ActionRequest) {
    return this.form!(request)
  }

  get hasExecute() {
    return !!this.execute
  }

  get hasForm() {
    return !!this.form
  }

  private getImageDataUri() {
    if (!this.iconName) {
      return null
    }
    const iconPath = path.resolve(__dirname, "..", "actions", this.iconName)
    if (fs.existsSync(iconPath)) {
      return new datauri(iconPath).content
    }
    return null
  }

}
