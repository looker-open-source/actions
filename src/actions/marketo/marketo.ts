import * as winston from "winston"
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
  description = "Update leads and add to Marketo campaign."
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

    const fieldMap = this.tagMap(Hub.allFields(requestJSON.fields))
    // determine in lookupField is present in fields
    const lookupField = request.formParams.lookupField
    if (!lookupField ||
      !Object.keys(fieldMap).find((name) => fieldMap[name].indexOf(lookupField) !== -1)) {
      throw "Marketo Lookup Field not present."
    }
    const leadList = this.leadList(fieldMap, requestJSON.data)

    // Push leads into Marketo and affiliate with a campaign
    const numLeadsAllowedPerCall = 300
    const chunked = MarketoAction.chunkify(leadList, numLeadsAllowedPerCall)
    const marketoClient = this.marketoClientFromRequest(request)
    const errors: {message: string}[] = []

    for (const chunk of chunked) {
      try {
        const newLeads = await marketoClient.lead.createOrUpdate(chunk, {lookupField})
        winston.info(`\n\n\n\nchunk: ${JSON.stringify(chunk)}\nnewLeads: ${JSON.stringify(newLeads)}`)
        const justIDs = newLeads.result.map((lead: {id: any}) => ({ id: lead.id }))
        const result = await marketoClient.campaign.request(request.formParams.campaignID, justIDs)
        winston.info(`result: ${result}\n\n`)
      } catch (e) {
        errors.push(e)
      }
    }

    if (errors.length > 0) {
      return new Hub.ActionResponse({
        success: false,
        message: errors.map((e) => e.message).join(", "),
      })
    } else {
      return new Hub.ActionResponse({ success: true })
    }
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Campaign ID",
      name: "campaignID",
      required: true,
      type: "string",
    }, {
      label: "Lookup Field for leads.",
      name: "lookupField",
      type: "string",
      description: "TODO add link to Marketo.",
      default: "email",
      required: true,
    }]
    return form
  }

  private tagMap(fields: Hub.Field[]) {
    // Map the looker columns to the Marketo columns using tags
    const fieldMap: {[name: string]: string[]} = {}
    let hasTagMap: string[] = []
    for (const field of fields) {
      if (field.tags && field.tags.find((tag: string) => tag.startsWith("marketo:"))) {
        hasTagMap = field.tags.filter((tag) => tag.startsWith("marketo:"))
          .map((tag) => tag.split("marketo:")[1])
        fieldMap[field.name] = hasTagMap
      }
    }
    return fieldMap
  }

  private leadList(fieldMap: {[key: string]: string[]}, rows: Hub.JsonDetail.Row[]) {
    // Create the list of leads to be sent
    const leadList: {[name: string]: any}[] = []
    for (const leadRow of rows) {
      const singleLead: {[name: string]: any} = {}
      for (const field of Object.keys(fieldMap)) {
        for (const tag of fieldMap[field]) {
          singleLead[tag] = leadRow[field].value
        }
      }
      leadList.push(singleLead)
    }
    return leadList
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
