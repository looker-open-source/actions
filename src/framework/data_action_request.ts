import * as sanitizeFilename from "sanitize-filename"

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

export class DataActionRequest {

  public static fromJSON(json: any) {

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
      request.lookerUrl = json.scheduled_plan.url
      request.title = json.scheduled_plan.title
    }

    if (json && json.data) {
      request.params = json.data
    }

    if (json && json.form_params) {
      request.formParams = json.form_params
    }

    return request
  }

  public type: DataActionType
  public params: IParamMap = {}
  public formParams: IParamMap = {}

  public attachment?: IDataActionAttachment

  public lookerUrl?: string
  public title?: string

  public suggestedFilename(): string | undefined {
    if (this.attachment) {
      if (this.title) {
        return sanitizeFilename(`${this.title}.${this.attachment.fileExtension}`)
      } else {
        return sanitizeFilename(`looker_file_${Date.now()}.${this.attachment.fileExtension}`)
      }
    }
  }

}
