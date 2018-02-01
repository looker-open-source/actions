import * as Hub from "../../hub"

const airtable: any = require("airtable")

export class AirtableAction extends Hub.Action {

  name = "airtable"
  label = "Airtable"
  iconName = "airtable/airtable.png"
  description = "Add records to an Airtable table."
  params = [
    {
      description: "API key for Airtable from https://airtable.com/account.",
      label: "Airtable API Key",
      name: "airtable_api_key",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  async execute(request: Hub.ActionRequest) {
    return new Promise<Hub.ActionResponse>((resolve, reject) => {

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

      const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
      const fieldMap: any = {}
      for (const field of fields) {
        fieldMap[field.name] = field.label_short || field.label || field.name
      }

      const airtableClient = this.airtableClientFromRequest(request)
      const table = airtableClient.base(request.formParams.base)(request.formParams.table)

      const errors: {message: string}[] = []
      for (const row of qr.data) {
        // transform row to {label short: value, }
        const record: any = {}
        for (const field of fields) {
          record[fieldMap[field.name]] = row[field.name].value
        }
        table.create(record, (err: {message: string}) => {
          if (err) {
            errors.push(err)
          }
        })
      }

      let response
      if (errors) {
        response = {
          success: false,
          message: errors.map((e) => e.message).join(", "),
        }
      }
      resolve(new Hub.ActionResponse(response))

    })
  }

  async form() {
    return new Promise<Hub.ActionForm>((resolve) => {

      const form = new Hub.ActionForm()
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

  private airtableClientFromRequest(request: Hub.ActionRequest) {
    return new airtable({apiKey: request.params.airtable_api_key})
  }

}

Hub.addAction(new AirtableAction())
