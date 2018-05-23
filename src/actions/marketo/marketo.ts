import { LookmlModelExploreField as Field } from "../../api_types/lookml_model_explore_field"
import * as Hub from "../../hub"

const MARKETO: any = require("node-marketo-rest")

export class MarketoAction extends Hub.Action {
  name = "marketo"
  label = "Marketo"
  iconName = "marketo/marketo.svg"
  description = "Add records to Marketo"
  params = [
    {
      description: "Identity server host URL",
      label: "URL",
      name: "url",
      required: true,
      sensitive: false,
    },
    {
      description: "Client ID from Marketo",
      label: "Client ID",
      name: "clientID",
      required: true,
      sensitive: false,
    },
    {
      description: "Client Secret from Marketo",
      label: "Client Secret",
      name: "clientSecret",
      required: true,
      sensitive: true,
    },

  ]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  usesStreaming = true

  async execute(request: Hub.ActionRequest) {
    if (!request.formParams.campaignID) {
      throw "Missing Campaign ID."
    }

    let fieldset: Field[] = []
    const fieldMap: any = {}
    const errors: Error[] = []
    const marketoClient = this.marketoClientFromRequest(request)

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
        let hasTagMap
        for (const field of fieldset) {
          hasTagMap = field.tags.map((tag: string) => {if (tag.startsWith("marketo:")) {
            return tag.split("marketo:")[1]
          }})
          fieldMap[field.name] = hasTagMap.find((tag: string | undefined) => tag !== undefined)
        }
      },
      onRow: async (row) => {
        const singleLead: any = {}
        for (const field of Object.keys(fieldMap)) {
          singleLead[fieldMap[field]] = row[field].value
        }
        try {
          const newLeads = await marketoClient.lead.createOrUpdate([singleLead])
          const justIDs = newLeads.result.map((lead: {id: number}) => ({ id: lead.id }))
          await marketoClient.campaign.request(request.formParams.campaignID, justIDs)
        } catch (e) {
          errors.push(e)
        }
      },
    })

    let response
    if (errors) {
      response = {
        success: false,
        message: errors.map((e) => e.message).join(", "),
      }
    }
    return new Hub.ActionResponse(response)
  }

  async form() {
      const form = new Hub.ActionForm()
      form.fields = [{
        label: "Campaign ID",
        name: "campaignID",
        required: true,
        type: "string",
      }]
      return form
  }

  private marketoClientFromRequest(request: Hub.ActionRequest) {
    return new MARKETO({
      endpoint: `${request.params.url}/rest`,
      identity: `${request.params.url}/identity`,
      clientId: request.params.clientID,
      clientSecret: request.params.clientSecret,
    })
  }
}

Hub.addAction(new MarketoAction())
