import * as https from "request-promise-native"
import * as winston from "winston"
import * as Hub from "../../hub"

export class KloudioAction extends Hub.Action {

  name = "kloudio"
  label = "Kloudio"
  iconName = "kloudio/kloudio.svg"
  description = "Add records to a Google Spreadsheet."
  params = [
    {
      description: "API URL for Kloudio from account page",
      label: "Kloudio API URL",
      name: "kloudio_api_url",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json."
    }

    if (!(request.formParams.api_key && request.formParams.url)) {
      throw "Missing API key or G sheets URL."
    }

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }

    /*const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
    const fieldMap: any = {}
    for (const field of fields) {
      fieldMap[field.name] = field.label_short || field.label || field.name
    }
    const records = qr.data.map((row: any) => {
      const record: any = {}
      for (const field of fields) {
        record[fieldMap[field.name]] = row[field.name].value
      }
      return record
    })*/

    let response
    try {
        const uri = JSON.stringify(request.params.kloudio_api_url)
        response = await https.post({
        url: uri,
        body: JSON.stringify({api_key: request.formParams.api_key, url: request.formParams.url, info: qr}),
         }).catch((_err) => { winston.error(_err.toString()) })
    } catch (e) {
      response = { success: false, message: e.message }
    }
    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "API Key",
      name: "api_key",
      required: true,
      type: "string",
    }, {
      label: "Google Sheets URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }

}

Hub.addAction(new KloudioAction())
