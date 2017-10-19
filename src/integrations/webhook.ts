import * as D from "../framework"

import * as req from "request"
import * as url from "url"

export abstract class WebhookIntegration extends D.Integration {

  domain: string

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
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json."
    }

    if (!request.formParams.url) {
      throw "Missing url."
    }

    if (!this.domain) {
      throw "Integration requires a domain."
    }

    const parsedUrl = url.parse(request.formParams.url)
    if (!parsedUrl.hostname) {
      throw "Incorrect domain for url."
    }
    // don't enforce sub-domain, just domain and tld
    const domain = parsedUrl.hostname.split(".").slice(-2).join(".")
    if (!(domain === this.domain)) {
      throw "Incorrect domain for url."
    }

    let response
    try {
      await req.post({
        url: request.formParams.url,
        form: request.attachment.dataJSON,
      })
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new D.DataActionResponse(response)
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
