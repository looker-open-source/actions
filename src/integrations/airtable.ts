import * as D from "../framework"

const airtable: any = require("airtable")

export class AirtableIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "Airtable_event"
    this.label = "Airtable"
    this.iconName = "Airtable.png"
    this.description = "Add traits to your users."
    this.params = [
      {
        description: "API key for Airtable from https://airtable.com/account.",
        label: "Airtable API Key",
        name: "airtable_api_key",
        required: true,
        sensitive: true,
      },
    ]
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

      if (!(request.formParams.base && request.formParams.table)) {
        reject("Missing Airtable base or table.")
        return
      }

      const qr = request.attachment.dataJSON
      if (!qr.fields || !qr.data) {
        reject("Request payload is an invalid format.")
        return
      }

      const airtableClient = this.airtableClientFromRequest(request)
      const table = airtableClient.base(request.formParams.base)(request.formParams.table)

      for (const row of qr.data) {
        table.create(row, (err: any) => {
          if (err) {
            reject(err)
          } else {
            resolve(new D.DataActionResponse())
          }
        })
      }

    })
  }

  async form() {
    return new Promise<D.DataActionForm>((resolve) => {

      const form = new D.DataActionForm()
      form.fields = [{
        label: "Airtable Base",
        name: "base",
        required: true,
        type: "string",
      }, {
        label: "Airtable Table",
        name: "table",
        required: true,
        type: "string",
      }]
      resolve(form)
    })
  }

  private airtableClientFromRequest(request: D.DataActionRequest) {
    return airtable({apiKey: request.params.airtable_api_key})
  }

}

D.addIntegration(new AirtableIntegration())
