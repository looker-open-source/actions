import * as D from "../framework"

const req: any = require("request")

export class WebhookIntegration extends D.Integration {

  constructor() {
    super()
    this.description = "Takes a data attachment and posts to a Webhook"
    this.requiredFields = []
    this.params = []
    this.supportedActionTypes = ["query"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json.")
        return
      }

      const qr = request.attachment.dataJSON

      if ( !request.formParams.url) {
        reject("Missing url.")
        return
      }

      const url = request.formParams.url

      req.post({
        url,
        body: qr,
      }, (error: any) => {
        if (error) {
          reject(error)
        } else {
          resolve(new D.DataActionResponse())
        }
      })

    })
  }

  async form() {
    return new Promise<D.DataActionForm>((resolve) => {

      const form = new D.DataActionForm()
      form.fields = [{
        label: "Webhook URL",
        name: "url",
        required: true,
        type: "string",
      }]
      resolve(form)
    })
  }
}
