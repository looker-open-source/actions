import * as sanitizeFilename from "sanitize-filename";

export interface ParamMap {
  [name: string]: string;
}

export type DataActionType = "cell" | "query" | "dashboard";
export type DataActionFormat = "txt" | "html" | "csv" | "json" | "xlsx" | "wysiwyg_pdf" | "assembled_pdf" | "wysiwyg_png";

export type DataActionAttachment = {
  data64 ?: string,
  dataBuffer ?: Buffer,
  dataJSON ?: any,
  mime ?: string,
  fileExtension ?: string,
};

export class DataActionRequest {

  public type : DataActionType;
  public params : ParamMap = {};
  public formParams : ParamMap = {};

  public attachment ?: DataActionAttachment;

  public lookerUrl ?: string;
  public title ?: string;

  public static fromJSON(json : any) {

    if (!json) {
      throw "Request body must be valid JSON.";
    }

    let request = new DataActionRequest();

    request.type = json.type;

    if (json && json.attachment) {
      request.attachment = {};
      request.attachment.mime = json.attachment.mimetype;
      request.attachment.fileExtension = json.attachment.extension;
      if (request.attachment.mime && json.attachment.data) {
        request.attachment.data64 = json.attachment.data;
        if (request.attachment.data64) {
          request.attachment.dataBuffer = new Buffer(request.attachment.data64, "base64");
        }
        if (request.attachment.mime == "application/json") {
          request.attachment.dataJSON = JSON.parse(json.attachment.data);
        }
      }
    }

    if (json && json.scheduled_plan) {
      request.lookerUrl = json.scheduled_plan.url;
      request.title = json.scheduled_plan.title;
    }

    if (json && json.data) {
      request.params = json.data;
    }

    if (json && json.form_params) {
      request.formParams = json.form_params;
    }

    return request;
  }

  public suggestedFilename() : string | undefined {
    if (this.attachment) {
      if (this.title) {
        return sanitizeFilename(`${this.title}.${this.attachment.fileExtension}`);
      } else {
        return sanitizeFilename(`looker_file_${Date.now()}.${this.attachment.fileExtension}`);
      }
    }
  }

}
