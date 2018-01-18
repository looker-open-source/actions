import * as express from "express"
import * as sanitizeFilename from "sanitize-filename"
import * as semver from "semver"
import { truncateString } from "./utils"

import {
  DataWebhookPayloadType as ActionType,
  WireResponseDataWebhookPayload,
} from "../api_types/data_webhook_payload"
import { DataWebhookPayloadScheduledPlanType } from "../api_types/data_webhook_payload_scheduled_plan"
import {
  IntegrationSupportedFormats as ActionFormat,
  IntegrationSupportedFormattings as ActionFormatting,
  IntegrationSupportedVisualizationFormattings as ActionVisualizationFormatting,
} from "../api_types/integration"
import { WireResponseQuery } from "../api_types/query"

export { ActionType, ActionFormat, ActionFormatting, ActionVisualizationFormatting }

export interface ParamMap {
  [name: string]: string | undefined
}

export interface ActionAttachment {
  dataBuffer?: Buffer
  encoding?: string
  dataJSON?: any
  mime?: string
  fileExtension?: string
}

export interface ActionScheduledPlan {
  /** ID of the scheduled plan */
  scheduledPlanId?: number | null
  /** Title of the scheduled plan. */
  title?: string | null
  /** Type of content of the scheduled plan. Valid values are: "Look", "Dashboard". */
  type?: DataWebhookPayloadScheduledPlanType
  /** URL of the content item in Looker. */
  url?: string | null
  /** ID of the query that the data payload represents. */
  queryId?: number | null
  /** Query that was run (not available for dashboards) */
  query?: WireResponseQuery | null
  /** A boolean representing whether this schedule payload has customized the filter values. */
  filtersDifferFromLook?: boolean
}

export class ActionRequest {

  static fromRequest(request: express.Request) {
    const actionRequest = this.fromJSON(request.body)
    actionRequest.instanceId = request.header("x-looker-instance")
    actionRequest.webhookId = request.header("x-looker-webhook-id")
    const userAgent = request.header("user-agent")
    if (userAgent) {
      const version = userAgent.split("LookerOutgoingWebhook/")[1]
      actionRequest.lookerVersion = semver.valid(version)
    }
    return actionRequest
  }

  static fromJSON(json: WireResponseDataWebhookPayload) {

    if (!json) {
      throw "Request body must be valid JSON."
    }

    const request = new ActionRequest()

    request.type = json.type!

    if (json && json.attachment) {
      request.attachment = {}
      request.attachment.mime = json.attachment.mimetype!
      request.attachment.fileExtension = json.attachment.extension!
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
        scheduledPlanId: json.scheduled_plan.scheduled_plan_id,
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

  attachment?: ActionAttachment
  formParams: ParamMap = {}
  params: ParamMap = {}
  scheduledPlan?: ActionScheduledPlan
  type: ActionType
  instanceId?: string
  webhookId?: string
  lookerVersion: string | null

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
