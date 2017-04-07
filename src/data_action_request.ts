export class DataActionRequest {

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

    let request = new DataActionRequest();

    if (json && json.attachment) {
      request.attachment = {};
      request.attachment.mime = json.mimetype;
      request.attachment.fileExtension = json.extension;
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

    return request;
  }

}
