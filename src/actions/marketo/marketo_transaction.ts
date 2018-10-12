/* tslint:disable no-console */
import * as Hub from "../../hub"
import { Queue } from "./queue"

const MARKETO: any = require("node-marketo-rest")

const numLeadsAllowedPerCall = 100

// function logJson(label: string, object: any) {
//   console.log("\n================================")
//   console.log(`${label}:\n`)
//   const json = `${JSON.stringify(object)}\n\n`
//   console.log(json)
// }

interface Result {
  leads: any[],
  skipped: any[],
  leadErrors: any[],
  campaignErrors: any[],
}

export default class MarketoTransaction {

  fieldMap: any
  marketo: any
  campaignId?: string
  lookupField?: string

  async handleRequest(request: Hub.ActionRequest): Promise<Hub.ActionResponse> {

    this.campaignId = request.formParams.campaignId
    if (!this.campaignId) {
      throw "Missing Campaign ID."
    }

    this.lookupField = request.formParams.lookupField
    if (!this.lookupField) {
      throw "Missing Lookup Field."
    }

    this.marketo = this.marketoClientFromRequest(request)

    const queue = new Queue()

    let rows: Hub.JsonDetail.Row[] = []

    const sendChunk = () => {
      const task = () => this.processChunk(rows)
      rows = []
      queue.addTask(task)
    }

    await request.streamJsonDetail({
      onFields: (fields) => {
        this.fieldMap = this.getFieldMap(Hub.allFields(fields))

        // determine if lookupField is present in fields
        if (! Object.keys(this.fieldMap).find((name) => this.fieldMap[name].indexOf(this.lookupField) !== -1)) {
          throw "Marketo Lookup Field for lead not present in query."
        }
      },
      onRow: (row) => {
        // add the row to our row queue
        rows.push(row)
        if (rows.length === numLeadsAllowedPerCall) {
          sendChunk()
        }
      },
    })

    // we awaited streamJsonDetail, so we've got all our rows now

    // if any rows are left, send one more chunk
    if (rows.length) {
      sendChunk()
    }

    // tell the queue we're finished adding rows and await the results
    const completed = await queue.finish()

    // filter all the successful results
    const results = (
      completed
      .filter((task: any) => task.result)
      .map((task: any) => task.result)
    )

    // filter all the request errors
    const errors = (
      completed
      .filter((task: any) => task.error)
      .map((task: any) => task.error)
    )

    // concatenate results and errors into a single result
    const result: any = {
      leads: results.reduce((memo: any[], r: Result) => memo.concat(r.leads), []),
      skipped: results.reduce((memo: any[], r: Result) => memo.concat(r.skipped), []),
      leadErrors: results.reduce((memo: any[], r: Result) => memo.concat(r.leadErrors), []),
      campaignErrors: results.reduce((memo: any[], r: Result) => memo.concat(r.campaignErrors), []),
      requestErrors: errors,
    }

    if (this.hasErrors(result)) {
      const message = this.getErrorMessage(result)
      return new Hub.ActionResponse({
        success: false,
        message,
      })
    }

    return new Hub.ActionResponse({ success: true })
  }

  async processChunk(chunk: any[]) {
    const result: Result = {
      leads: this.getLeadList(chunk),
      skipped: [],
      leadErrors: [],
      campaignErrors: [],
    }

    if (Math.random() > 0.8) {
      throw "Fake rejection"
    }

    const leadResponse = await this.marketo.lead.createOrUpdate(result.leads, { lookupField: this.lookupField })
    if (Array.isArray(leadResponse.errors) && leadResponse.errors.length) {
      result.leadErrors = leadResponse.errors
    }

    const ids: any[] = []
    leadResponse.result.forEach((lead: any, i: number) => {
      if (lead.id) {
        ids.push({id: lead.id})
      } else {
        result.leads[i].result = lead
        result.skipped.push(result.leads[i])
      }
    })

    const campaignResponse = await this.marketo.campaign.request(this.campaignId, ids)
    if (Array.isArray(campaignResponse.errors) && campaignResponse.errors.length) {
      result.campaignErrors = campaignResponse.errors
    }

    return result
  }

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

  private marketoClientFromRequest(request: Hub.ActionRequest) {
    return new MARKETO({
      endpoint: `${request.params.url}/rest`,
      identity: `${request.params.url}/identity`,
      clientId: request.params.clientID,
      clientSecret: request.params.clientSecret,
    })
  }

  private getLeadList(rows: Hub.JsonDetail.Row[]) {
    // Create the list of leads to be sent
    const leadList: {[name: string]: any}[] = []
    for (const leadRow of rows) {
      const singleLead: {[name: string]: any} = {}
      for (const field of Object.keys(this.fieldMap)) {
        for (const tag of this.fieldMap[field]) {
          singleLead[tag] = leadRow[field].value
        }
      }
      leadList.push(singleLead)
    }
    return leadList
  }

  private hasErrors(result: any) {
    return (
      result.skipped.length
      || result.leadErrors.length
      || result.campaignErrors.length
      || result.requestErrors.length
    )
  }

  private getErrorMessage(result: Result) {
    const condensed: any = {}
    if (result.skipped.length) {
      condensed.skipped = this.getSkippedReasons(result.skipped)
    }
    if (result.leadErrors.length) {
      condensed.leadErrors = result.leadErrors
    }
    if (result.campaignErrors.length) {
      condensed.campaignErrors = result.campaignErrors
    }
    return JSON.stringify(condensed)
  }

  private getSkippedReasons(skipped: any[]) {
    const reasons: any = {}

    skipped.forEach((item: any) => {
      // get the reason item was skipped
      const reason = item.result.reasons[0].message
      // get the list of emails with that same reason
      // or create the list if this is the first one
      const list = reasons[reason] || (reasons[reason] = [])
      list.push(item.email)
    })

    return reasons
  }

}
