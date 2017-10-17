import * as express from "express"
import * as sanitizeFilename from "sanitize-filename"
import { truncateString } from "./utils"

export interface IParamMap {
  [name: string]: string
}

export type DataActionType = "cell" | "query" | "dashboard"
export type DataActionFormat =
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

export interface IDataActionAttachment {
  dataBuffer?: Buffer
  dataJSON?: any
  mime?: string
  fileExtension?: string
}

export interface IDataActionScheduledPlan {
  filtersDifferFromLook?: boolean
  queryId?: number
  scheduledPlanId?: number
  title?: string
  type?: string
  url?: string
}

export class DataActionRequest {

  static fromRequest(request: express.Request) {
    const dataActionRequest = this.fromJSON(request.body)
    dataActionRequest.instanceId = request.header("x-looker-instance")
    dataActionRequest.webhookId = request.header("x-looker-webhook-id")
    return dataActionRequest
  }

  static fromJSON(json: any) {

    if (!json) {
      throw "Request body must be valid JSON."
    }

    const request = new DataActionRequest()

    request.type = json.type

    if (json && json.attachment) {
      request.attachment = {}
      request.attachment.mime = json.attachment.mimetype
      request.attachment.fileExtension = json.attachment.extension
      if (request.attachment.mime && json.attachment.data) {
        if (json.attachment.data) {
          const encoding = request.attachment.mime.endsWith(";base64") ? "base64" : "utf8"
          request.attachment.dataBuffer = Buffer.from(json.attachment.data, encoding)

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

  attachment?: IDataActionAttachment
  formParams: IParamMap = {}
  params: IParamMap = {}
  scheduledPlan?: IDataActionScheduledPlan
  type: DataActionType
  instanceId?: string
  webhookId?: string

  suggestedFilename(): string | undefined {
    if (this.attachment) {
      if (this.scheduledPlan && this.scheduledPlan.title) {
        return sanitizeFilename(`${this.scheduledPlan.title}.${this.attachment.fileExtension}`)
      } else {
        return sanitizeFilename(`looker_file_${Date.now()}.${this.attachment.fileExtension}`)
      }
    }
  }

  suggestedTruncatedMessage(maxLines: number, maxMessage: number): string | undefined  {
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
      body = truncateString(body, maxMessage)

      return body
    }
  }

}
