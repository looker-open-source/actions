import * as express from "express"
import * as sanitizeFilename from "sanitize-filename"
import { truncateString } from "./utils"

export interface IParamMap {
  [name: string]: string | undefined
}

export type ActionType = "cell" | "query" | "dashboard"
export type ActionFormat =
  "assembled_pdf" |
  "csv" |
  "html" |
  "json" |
  "json_detail" |
  "inline_json" |
  "txt" |
  "wysiwyg_pdf" |
  "wysiwyg_png" |
  "xlsx"

export interface IActionAttachment {
  dataBuffer?: Buffer
  encoding?: string
  dataJSON?: any
  mime?: string
  fileExtension?: string
}

export interface IActionScheduledPlan {
  filtersDifferFromLook?: boolean
  queryId?: number
  scheduledPlanId?: number
  title?: string
  type?: string
  url?: string
}

export class ActionRequest {

  static fromRequest(request: express.Request) {
    const actionRequest = this.fromJSON(request.body)
    actionRequest.instanceId = request.header("x-looker-instance")
    actionRequest.webhookId = request.header("x-looker-webhook-id")
    return actionRequest
  }

  static fromJSON(json: any) {

    if (!json) {
      throw "Request body must be valid JSON."
    }

    const request = new ActionRequest()

    request.type = json.type

    if (json && json.attachment) {
      request.attachment = {}
      request.attachment.mime = json.attachment.mimetype
      request.attachment.fileExtension = json.attachment.extension
      if (request.attachment.mime && json.attachment.data) {
        if (json.attachment.data) {
          request.attachment.encoding = request.attachment.mime.endsWith(";base64") ? "base64" : "utf8"
          request.attachment.dataBuffer = Buffer.from(json.attachment.data, request.attachment.encoding)

          if (request.attachment.mime === "application/json") {
            request.attachment.dataJSON = JSON.parse(json.attachment.data)
          }
        }
      }
    }

    if (json && json.scheduled_plan) {
      request.scheduledPlan = {
        filtersDifferFromLook: json.scheduled_plan.filters_differ_from_look,
        queryId: json.scheduled_plan.query_id,
        scheduledPlanId: json.scheduled_plan_id,
        title: json.scheduled_plan.title,
        type: json.scheduled_plan.type,
        url: json.scheduled_plan.url,
      }
    }

    if (json && json.data) {
      request.params = json.data
    }

    if (json && json.form_params) {
      request.formParams = json.form_params
    }

    return request
  }

  attachment?: IActionAttachment
  formParams: IParamMap = {}
  params: IParamMap = {}
  scheduledPlan?: IActionScheduledPlan
  type: ActionType
  instanceId?: string
  webhookId?: string

  suggestedFilename() {
    if (this.attachment) {
      if (this.scheduledPlan && this.scheduledPlan.title) {
        return sanitizeFilename(`${this.scheduledPlan.title}.${this.attachment.fileExtension}`)
      } else {
        return sanitizeFilename(`looker_file_${Date.now()}.${this.attachment.fileExtension}`)
      }
    }
  }

  /** creates a truncated message with a max number of lines and max number of characters with Title, Url,
   * and truncated Body of payload
   * @param {number} maxLines - maximum number of lines to truncate message
   * @param {number} maxCharacters - maximum character to truncate
   */
  suggestedTruncatedMessage(maxLines: number, maxCharacters: number)  {
    if (this.attachment && this.attachment.dataBuffer) {
      let title = ""
      let url = ""

      if (this.scheduledPlan) {
        if (this.scheduledPlan.title) {
          title = `${this.scheduledPlan.title}:\n`
        }
        if (this.scheduledPlan.url) {
          url = this.scheduledPlan.url
          title = title + url + "\n"
        }
      }

      const truncatedLines = this.attachment.dataBuffer
          .toString("utf8")
          .split("\n")
          .slice(0, maxLines)
      if (truncatedLines.length === maxLines) {
        truncatedLines.push("")
      }
      const newMessage = truncatedLines.join("\n")
      let body = title + newMessage
      body = truncateString(body, maxCharacters)

      return body
    }
  }

}
