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

export interface IWireResponseQuery {
  /** Unique Id */
  id?: number
  /** Model */
  model?: string
  /** View */
  view?: string
  /** Fields */
  fields?: string[]
  /** Pivots */
  pivots?: string[]
  /** Fill Fields */
  fill_fields?: string[]
  /** Filters */
  filters?: {[key: string]: string}
  /** Filter Expression */
  filter_expression?: string
  /** Sorts */
  sorts?: string[]
  /** Limit */
  limit?: string
  /** Column Limit */
  column_limit?: string
  /** Total */
  total?: boolean
  /** Raw Total */
  row_total?: string
  /** Runtime */
  runtime?: number
  /** Visualization configuration properties. */
  vis_config?: {[key: string]: any}
  /** The filter_config represents the state of the filter UI. */
  filter_config?: {[key: string]: any}
  /** Visible UI Sections */
  visible_ui_sections?: string
  /** Slug */
  slug?: string
  /** Dynamic Fields */
  dynamic_fields?: any[]
  /** Client Id */
  client_id?: string
  /** Share Url */
  share_url?: string
  /** Expanded Share Url */
  expanded_share_url?: string
  /** Expanded Url */
  url?: string
  /** Query Timezone */
  query_timezone?: string
  /** Has Table Calculations */
  has_table_calculations?: boolean
}

export enum DataWebhookPayloadScheduledPlanType {
  Look = "Look",
  Dashboard = "Dashboard",
}

export interface IActionScheduledPlan {
  /** ID of the scheduled plan */
  scheduledPlanId?: number
  /** Title of the scheduled plan. */
  title?: string
  /** Type of content of the scheduled plan. Valid values are: "Look", "Dashboard". */
  type?: DataWebhookPayloadScheduledPlanType
  /** URL of the content item in Looker. */
  url?: string
  /** ID of the query that the data payload represents. */
  queryId?: number
  /** Query that was run (not available for dashboards) */
  query?: IWireResponseQuery
  /** A boolean representing whether this schedule payload has customized the filter values. */
  filtersDifferFromLook?: boolean
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
        query: json.scheduled_plan.query,
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
