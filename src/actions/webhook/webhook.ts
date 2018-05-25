import * as Hub from "../../hub"

import * as req from "request-promise-native"
import * as url from "url"

export abstract class WebhookAction extends Hub.Action {

  abstract domain: string

  requiredFields = []
  params = []
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json."
    }

    if (!request.formParams.url) {
      throw "Missing url."
    }

    if (!this.domain) {
      throw "Action requires a domain."
    }

    const providedUrl = request.formParams.url
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
      }).promise()
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}
