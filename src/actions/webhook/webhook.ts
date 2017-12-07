import * as D from "../../framework"

import * as req from "request-promise-native"
import * as url from "url"

export abstract class WebhookAction extends D.Action {

  domain: string

  constructor() {
    super()
    this.requiredFields = []
    this.params = []
    this.supportedActionTypes = [D.ActionType.Query]
    this.supportedFormats = [D.ActionFormat.JsonDetail]
    this.supportedFormattings = [D.ActionFormatting.Unformatted]
    this.supportedVisualizationFormattings = [D.ActionVisualizationFormatting.Noapply]
  }

  async execute(request: D.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json."
    }

    if (!request.formParams.url) {
      throw "Missing url."
    }

    if (!this.domain) {
      throw "Integration requires a domain."
    }

    const providedUrl = request.formParams.url!
    const parsedUrl = url.parse(providedUrl)
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
        url: providedUrl,
        form: request.attachment.dataJSON,
      })
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new D.ActionResponse(response)
  }

  async form() {
    const form = new D.ActionForm()
    form.fields = [{
      label: "Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}
