import * as Hub from "../../hub"

const MARKETO: any = require("node-marketo-rest")

export class MarketoAction extends Hub.Action {
  private static chunkify(toChunk: any[], chunkSize: number) {
    const arrays = []
    while (toChunk.length > 0) {
      arrays.push(toChunk.splice(0, chunkSize))
    }
    return arrays
  }

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

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json."
    }

    if (!request.formParams.campaignID) {
      throw "Missing Campaign ID."
    }

    const requestJSON = request.attachment.dataJSON
    if (!requestJSON.fields || !requestJSON.data) {
      throw "Request payload is an invalid format."
    }
    const fieldMap = this.tagMap(requestJSON)
    const leadList = this.leadList(fieldMap, requestJSON)

    // Push leads into Marketo and affiliate with a campaign
    const numLeadsAllowedPerCall = 300
    const chunked = MarketoAction.chunkify(leadList, numLeadsAllowedPerCall)
    const marketoClient = this.marketoClientFromRequest(request)
    const errors: {message: string}[] = []
    for (const chunk of chunked) {
      try {
        const newLeads = await marketoClient.lead.createOrUpdate(chunk)
        const justIDs = newLeads.result.map((lead: {id: number}) => ({ id: lead.id }))
        await marketoClient.campaign.request(request.formParams.campaignID, justIDs)
      } catch (e) {
        errors.push(e)
      }
    }

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

  private tagMap(requestJSON: {fields: any}) {
    // Map the looker columns to the Marketo columns using tags
    const fields: any[] = [].concat(...Object.keys(requestJSON.fields).map((k) => requestJSON.fields[k]))
    const fieldMap: any = {}
    let hasTagMap
    for (const field of fields) {
      hasTagMap = field.tags.map((tag: string) => {if (tag.startsWith("marketo:")) {
        return tag.split("marketo:")[1]
      }})
      fieldMap[field.name] = hasTagMap.find((tag: string | undefined) => tag !== undefined)
    }
    return fieldMap
  }

  private leadList(fieldMap: {[key: string]: string}, requestJSON: {data: any}) {
    // Create the list of leads to be sent
    const leadList = []
    for (const leadRow of requestJSON.data) {
      const singleLead: any = {}
      for (const field of Object.keys(fieldMap)) {
        singleLead[fieldMap[field]] = leadRow[field].value
      }
      leadList.push(singleLead)
    }
    return leadList
  }
}

Hub.addAction(new MarketoAction())
