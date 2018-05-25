import { LookmlModelExploreField as Field } from "../../api_types/lookml_model_explore_field"
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
  usesStreaming = true
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  async execute(request: Hub.ActionRequest) {
    if (!(request.formParams.base && request.formParams.table)) {
      throw "Missing Airtable base or table."
    }

    let fieldset: Field[] = []
    const errors: Error[] = []
    const fieldLabelMap: {[name: string]: string } = {}

    const airtableClient = this.airtableClientFromRequest(request)
    const base = airtableClient.base(request.formParams.base)
    const table = base(request.formParams.table)

    await request.streamJsonDetail({
      onFields: (fields) => {
        if (fields.dimensions) {
          fieldset = fieldset.concat(fields.dimensions)
        }
        if (fields.measures) {
          fieldset = fieldset.concat(fields.measures)
        }
        if (fields.filters) {
          fieldset = fieldset.concat(fields.filters)
        }
        if (fields.parameters) {
          fieldset = fieldset.concat(fields.parameters)
        }
        for (const field of fieldset) {
          fieldLabelMap[field.name] = field.label_short || field.label || field.name
        }
      },
      onRow: async (row) => {
        const record: {[name: string]: any} = {}
        for (const field of fieldset) {
          record[fieldLabelMap[field.name]] = row[field.name].value
        }
        try {
          await new Promise<any>((resolve, reject) => {
            table.create(record, (err: any, rec: any) => {
              if (err) {
                /* tslint:disable no-console */
                console.log(`err: ${JSON.stringify(err)}`)
                reject(err)
              } else {
                resolve(rec)
              }
            })
          })
        } catch (e) {
          console.log(`catch e: ${JSON.stringify(e)}`)
          errors.push(e)
        }
      },
    })
    if (errors) {
      console.log(`return: ${JSON.stringify(errors)}`)
      return new Hub.ActionResponse({
        success: false,
        message: errors.map((e) => e.message).join(", "),
      })
    } else {
      console.log(`return`)
      return new Hub.ActionResponse({ success: true })
    }
  }

  async form() {
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
    return form
  }

  private airtableClientFromRequest(request: Hub.ActionRequest) {
    return new airtable({apiKey: request.params.airtable_api_key})
  }

}

Hub.addAction(new AirtableAction())
