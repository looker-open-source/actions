/* tslint:disable no-console */
import * as Hub from "../../hub"
import { Queue } from "./queue"

const MARKETO: any = require("node-marketo-rest")

const numLeadsAllowedPerCall = 100

function logJson(label: string, object: any) {
  console.log("\n================================")
  console.log(`${label}:\n`)
  const json = `${JSON.stringify(object)}\n\n`
  console.log(json)
}

interface Result {
  id: number,
  leads: any[],
  skipped: any[],
  leadErrors: any[],
  campaignErrors: any[],
}

export default class MarketoTransaction {

  // private static chunkify(toChunk: any[], chunkSize: number) {
  //   const arrays = []
  //   while (toChunk.length > 0) {
  //     arrays.push(toChunk.splice(0, chunkSize))
  //   }
  //   return arrays
  // }

  // rows: Hub.JsonDetail.Row[] = []
  // queue: Promise<any>[] = []
  fieldMap: any
  marketo: any
  campaignId?: string
  lookupField?: string

  async handleRequest(request: Hub.ActionRequest): Promise<Hub.ActionResponse> {

    logJson("request", request)

    console.time("all done")

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
    let chunkId = 0

    const makeTask = (chunk: Hub.JsonDetail.Row[]) => {
      const id = chunkId++
      return () => {
        return this.processChunk(chunk, id)
      }
    }

    function sendChunk() {
      const task = makeTask(rows)
      rows = []
      queue.addTask(task)
    }

    console.time("streamJsonDetail")
    await request.streamJsonDetail({
      onFields: (fields) => {
        console.log("onFields", fields)
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
    console.timeEnd("streamJsonDetail")

    // we awaited streamJsonDetail, so we've got all our rows now

    // if any rows are left, send one more chunk
    if (rows.length) {
      sendChunk()
    }

    // tell the queue we're finished adding rows and await the results
    const results = await queue.finish()

    // sort results by chunk id so they're in the same order we sent them
    results.sort((a: Result, b: Result) => b.id - a.id)

    logJson("results", results.map((r: Result) => r.id))
    logJson("results[0]", results[0])

    // if (this.hasErrors(result)) {
    //   const message = this.getErrorMessage(result)
    //   console.log("message", message)
    //   return new Hub.ActionResponse({
    //     success: false,
    //     message,
    //   })
    // }

    console.timeEnd("all done")

    return new Hub.ActionResponse({ success: true })
  }

  async processChunk(chunk: any[], id: number) {
    const result: Result = {
      id,
      leads: this.getLeadList(chunk),
      skipped: [],
      leadErrors: [],
      campaignErrors: [],
    }

    try {
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
          result.skipped.push(chunk[i])
        }
      })

      const campaignResponse = await this.marketo.campaign.request(this.campaignId, ids)
      if (Array.isArray(campaignResponse.errors) && campaignResponse.errors.length) {
        result.campaignErrors = campaignResponse.errors
      }

    } catch (err) {
      console.error(err)
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

  private marketoClientFromRequest(request: Hub.ActionRequest) {
    return new MARKETO({
      endpoint: `${request.params.url}/rest`,
      identity: `${request.params.url}/identity`,
      clientId: request.params.clientID,
      clientSecret: request.params.clientSecret,
    })
  }

  // private hasErrors(result: Result) {
  //   return (
  //     result.skipped.length
  //     || result.leadErrors.length
  //     || result.campaignErrors.length
  //   )
  // }

  // private getErrorMessage(result: Result) {
  //   const condensed: any = {}
  //   if (result.skipped.length) {
  //     condensed.skipped = this.getSkippedReasons(result.skipped)
  //   }
  //   if (result.leadErrors.length) {
  //     condensed.leadErrors = result.leadErrors
  //   }
  //   if (result.campaignErrors.length) {
  //     condensed.campaignErrors = result.campaignErrors
  //   }
  //   return JSON.stringify(condensed)
  // }

  // private getSkippedReasons(skipped: any[]) {
  //   const reasons: any = {}

  //   skipped.forEach((item: any) => {
  //     // get the reason item was skipped
  //     const reason = item.result.reasons[0].message
  //     // get the list of emails with that same reason
  //     // or create the list if this is the first one
  //     const list = reasons[reason] || (reasons[reason] = [])
  //     list.push(item.email)
  //   })

  //   return reasons
  // }

}
