import * as D from "../framework"

import * as URL from "url"
import {LookerAPIClient} from "./looker"
// import { SendGridIntegration } from "./sendgrid"

const TAG = "looker_api_url"

// const sendgrid = new SendGridIntegration()

export class LookerAPIIntegration extends D.Integration {

  constructor() {
    super()
    this.requiredFields = [{tag: TAG}]
    this.params = [
      {
        name: "base_url",
        label: "Looker base_url",
        required: true,
        sensitive: false,
        description: "https://instancename.looker.com",
      },
      {
        name: "looker_api_client",
        label: "Looker API Client",
        required: true,
        sensitive: false,
        description: "https://github.com/looker/looker-sdk-ruby/blob/master/authentication.md",
      },
      {
        name: "looker_api_secret",
        label: "Looker API Secret",
        required: true,
        sensitive: true,
        description: "https://github.com/looker/looker-sdk-ruby/blob/master/authentication.md",
      },
    ]// .concat(sendgrid.params)
    this.supportedActionTypes = ["cell", "query"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
  }

  async action(request: D.DataActionRequest) {
    let lookerUrls: string[] = []
    switch (request.type) {
      case "query":
        if (!(request.attachment && request.attachment.dataJSON)) {
          throw "Couldn't get data from attachment."
        }

        const qr = request.attachment.dataJSON
        if (!qr.fields || !qr.data) {
          throw "Request payload is an invalid format."
        }
        const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
        const identifiableFields = fields.filter((f: any) =>
          f.tags && f.tags.some((t: string) => t === TAG),
        )
        if (identifiableFields.length === 0) {
          throw `Query requires a field tagged ${TAG}.`
        }
        lookerUrls = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
        break
      case "cell":
        const value = request.params.value
        if (!value) {
          throw "Couldn't get data from attachment."
        }
        lookerUrls = [value]
        break
    }

    const lookerClient = this.lookerClientFromRequest(request)
    let response
    try {
      await Promise.all(lookerUrls.map(async (lookerUrl) => {
        const lookerPath = URL.parse(lookerUrl).path
        if (!lookerPath) {
          throw "Invalid Looker URL."
        }
        return lookerClient.getAsync(lookerPath)
      }))
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new D.DataActionResponse(response)

  }

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      label: "Email Address",
      name: "email",
      required: true,
      type: "string",
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]
    return form
  }

  private lookerClientFromRequest(request: D.DataActionRequest) {
    return new LookerAPIClient({
      baseUrl: request.params.base_url!,
      clientId: request.params.looker_api_client!,
      clientSecret: request.params.looker_api_secret!,
    })
  }
}
