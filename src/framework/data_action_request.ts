export interface ParamMap {
  [name: string]: string;
}

export class DataActionRequest {

  public type : "cell" | "query";
  public params ?: ParamMap;
  public formParams ?: ParamMap;

  public attachment ?: {
    data64 ?: string,
    dataBuffer ?: Buffer,
    dataJSON ?: any,
    mime ?: string,
    fileExtension ?: string,
  };

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
          request.attachment.dataBuffer = new Buffer(request.attachment.data64, 'base64');
        }
      }
    }

    if (json && json.scheduled_plan) {
      request.lookerUrl = json.scheduled_plan.url;
      request.title = json.scheduled_plan.title;
    }

    // TODO: solidify api between cell and query level actions
    if (json && json.params) {
      request.params = json.params;
    }

    if (json && json.form_params) {
      request.formParams = json.form_params;
    }

    return request;
  }

}
