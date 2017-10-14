import * as D from "../framework"

const req: any = require("request")

export class WebhookIntegration extends D.Integration {

  constructor() {
    super()
    this.name = "webhook"
    this.label = "Webhook"
    this.iconName = "webhook.svg"
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

      if ( !request.formParams.url) {
        reject("Missing url.")
        return
      }

      let response
      req.post({
        url: request.formParams.url,
        form: request.attachment.dataJSON,
      }, (error: any) => {
        if (error) {
          response = error.message
        }
      })

      resolve(new D.DataActionResponse(response))

    })
  }

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      label: "Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}

D.addIntegration(new WebhookIntegration())
