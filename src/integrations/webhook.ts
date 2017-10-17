import * as D from "../framework"

import * as req from "request"
import * as url from "url"

export abstract class WebhookIntegration extends D.Integration {

  hostname: string

  constructor() {
    super()
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

      if (!request.formParams.url) {
        reject("Missing url.")
        return
      }

      if (!this.hostname) {
        reject("Integration requires a hostname.")
        return
      }

      const parsedUrl = url.parse(request.formParams.url)
      if (!parsedUrl.hostname ||
        !(parsedUrl.hostname === this.hostname)) {
        reject("Incorrect hostname for url.")
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
