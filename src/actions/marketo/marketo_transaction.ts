/* tslint:disable no-console */
import * as Hub from "../../hub"

const MARKETO: any = require("node-marketo-rest")

const numLeadsAllowedPerCall = 100

export default class MarketoTransaction {

  rows: Hub.JsonDetail.Row[] = []
  queue: Promise<any>[] = []
  fieldMap: any
  marketo: any
  lookupField = ""

  async handleRequest(request: Hub.ActionRequest): Promise<Hub.ActionResponse> {

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

    this.fieldMap = this.getFieldMap(Hub.allFields(requestJSON.fields))

    // determine if lookupField is present in fields
    this.lookupField = request.formParams.lookupField || ""
    if (
      ! this.lookupField
      || ! Object.keys(this.fieldMap).find((name) => this.fieldMap[name].indexOf(this.lookupField) !== -1)
    ) {
      throw "Marketo Lookup Field for lead not present in query."
    }

    this.rows = []
    this.queue = []
    this.marketo = this.marketoClientFromRequest(request)

    await request.streamJsonDetail({
      // onFields: (fields) => {
      //   console.log("onFields", fields)
      //   // build this.fieldMap for getLeadtFromRow to refer to?
      //   // for now constructing it above from requestJSON.fields
      //   // instead of here, cuz we need it to valid the form input
      // },
      // onRanAt: (iso8601string) => {
      //   console.log("onRanAt", iso8601string)
      // },
      onRow: (row) => {
        // add the row to our row queue
        this.rows.push(row)

        // if the row queue has enough items to make a request,
        // send a chunk and flush the row queue
        if (this.rows.length === numLeadsAllowedPerCall) {
          this.flushRows()
        }
      },
    })

    // if there are any unsent rows, send them now
    this.flushRows()

    console.log("this.queue.length", this.queue.length)

    const results = await Promise.all(this.queue)
    console.log("all done", results)

    return new Hub.ActionResponse({ success: true })
  }

  flushRows() {
    console.log("flushRows")
    if (this.rows.length) {
      const request = this.sendChunk(this.rows)
      this.queue.push(request)
      this.rows = []
    }
  }

  async sendChunk(rows: Hub.JsonDetail.Row[]) {
    console.log("sendChunk")
    if (! rows) { return }
    const leadList = this.getLeadList(this.fieldMap, rows)
    // console.log("leadList", leadList)
    // TODO wrap Marketo API in a promise that resolves with { success: [], failed: [] }

    const errors = []
    let leadResponse
    try {
      leadResponse = await this.marketo.lead.createOrUpdate(leadList, {
        lookupField: this.lookupField,
      })
      console.log(JSON.stringify(leadResponse))
      // if (leadResponse.success && leadResponse.success === false) {
      //   errors.concat(leadResponse.errors)
      //   break
      // }
      // const justIDs = leadResponse.result.filter((lead: {id: any}) => lead.id !== null)
      //   .map((lead: {id: any}) => ({ id: lead.id }))
      // const campaignResponse = await marketoClient.campaign.request(request.formParams.campaignID, justIDs)
      // if (campaignResponse.success && campaignResponse.success === false) {
      //   errors.concat(campaignResponse.errors)
      //   break
      // }
    } catch (err) {
      console.log(JSON.stringify(err))
      errors.push(err)
    }

    return {
      leadResponse,
      errors,
    }
  }

  //   // // Push leads into Marketo and affiliate with a campaign
  //   // const chunked = MarketoAction.chunkify(leadList, numLeadsAllowedPerCall)
  //   // const marketoClient = this.marketoClientFromRequest(request)
  //   // const errors: {message: string}[] = []

  //   // for (const chunk of chunked) {
  //   //   try {
  //   //     const leadResponse = await marketoClient.lead.createOrUpdate(chunk, {lookupField})
  //   //     if (leadResponse.success && leadResponse.success === false) {
  //   //       errors.concat(leadResponse.errors)
  //   //       break
  //   //     }
  //   //     const justIDs = leadResponse.result.filter((lead: {id: any}) => lead.id !== null)
  //   //       .map((lead: {id: any}) => ({ id: lead.id }))
  //   //     const campaignResponse = await marketoClient.campaign.request(request.formParams.campaignID, justIDs)
  //   //     if (campaignResponse.success && campaignResponse.success === false) {
  //   //       errors.concat(campaignResponse.errors)
  //   //       break
  //   //     }
  //   //   } catch (e) {
  //   //     errors.push(e)
  //   //   }
  //   // }

  //   // if (errors.length > 0) {
  //   //   return new Hub.ActionResponse({
  //   //     success: false,
  //   //     message: errors.map((e) => e.message).join(", "),
  //   //   })
  //   // } else {
  //   return new Hub.ActionResponse({ success: true })
  //   // }
  // }

  private getFieldMap(fields: Hub.Field[]) {
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

  private getLeadList(fieldMap: {[key: string]: string[]}, rows: Hub.JsonDetail.Row[]) {
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
