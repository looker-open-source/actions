/* tslint:disable no-console */
import * as Hub from "../../hub"

const MARKETO: any = require("node-marketo-rest")

const numLeadsAllowedPerCall = 100

function logJson(label: string, object: any) {
  console.log("\n================================")
  console.log(`${label}:\n`)
  const json = `${JSON.stringify(object)}\n\n`
  console.log(json)
}

interface Result {
  skipped: any[],
  leadErrors: any[],
  campaignErrors: any[]
}

export default class MarketoTransaction {

  private static chunkify(toChunk: any[], chunkSize: number) {
    const arrays = []
    while (toChunk.length > 0) {
      arrays.push(toChunk.splice(0, chunkSize))
    }
    return arrays
  }

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

    // determine if lookupField is present in fields
    this.lookupField = request.formParams.lookupField
    if (!this.lookupField) {
      throw "Missing Lookup Field."
    }

    this.marketo = this.marketoClientFromRequest(request)
    const rows: Hub.JsonDetail.Row[] = []

    // let counter = 0
    // const min = 0
    // const max = min + numLeadsAllowedPerCall

    console.time("streamJsonDetail")
    await request.streamJsonDetail({
      onFields: (fields) => {
        console.log("onFields", fields)
        this.fieldMap = this.getFieldMap(Hub.allFields(fields))

        if (! Object.keys(this.fieldMap).find((name) => this.fieldMap[name].indexOf(this.lookupField) !== -1)) {
          throw "Marketo Lookup Field for lead not present in query."
        }
      },
      // onRanAt: (iso8601string) => {
      //   console.log("onRanAt", iso8601string)
      // },
      onRow: (row) => {
        console.log("row", row)
        if (! this.fieldMap) { return }
        // counter++
        // if (counter < min) {
        //   return
        // }
        // if (counter >= max) {
        //   return
        // }

        // add the row to our row queue
        rows.push(row)
      },
    })
    console.timeEnd("streamJsonDetail")

    rows.push({
      "marketo_license_users.email": { value: "acliffordhubspot.com" },
      "marketo_license_users.instance_host_url": { value: "https://looker.hubspotcentral.net" },
      "marketo_license_users.is_admin": { value: "false" },
      "marketo_license_users.is_current_user": { value: "true" },
      "marketo_license_users.is_mailable": { value: "true" },
      "marketo_license_users.is_technical_contact": { value: "false" },
      "marketo_license_users.uuid": { value: "cfccf04303fd9b823beed1bf3ecf9cb828b99753bf9834620fad29a4356428b3" },
      "marketo_license_users.subscribed_to_marketing": { value: "true" },
      "marketo_license_users.subscribed_to_release": { value: "true" },
    })

    rows.push({
      "marketo_license_users.email": { value: "nickfoo@.com" },
      "marketo_license_users.instance_host_url": { value: "https://looker.hubspotcentral.net" },
      "marketo_license_users.is_admin": { value: "false" },
      "marketo_license_users.is_current_user": { value: "true" },
      "marketo_license_users.is_mailable": { value: "true" },
      "marketo_license_users.is_technical_contact": { value: "false" },
      "marketo_license_users.uuid": { value: "cfccf04303fd9b823beed1bf3ecf9cb828b99753bf9834620fad29a4356428b4" },
      "marketo_license_users.subscribed_to_marketing": { value: "true" },
      "marketo_license_users.subscribed_to_release": { value: "true" },
    })

    console.log("rows.length", rows.length)

    console.time("getLeadList")
    const leadList = this.getLeadList(rows)
    console.timeEnd("getLeadList")

    console.time("chunkify")
    const chunks = MarketoTransaction.chunkify(leadList, numLeadsAllowedPerCall)
    console.timeEnd("chunkify")

    console.time("sendChunks")
    const result = await this.sendChunks(chunks)
    console.timeEnd("sendChunks")

    console.timeEnd("all done")

    if (this.hasErrors(result)) {
      const message = this.getErrorMessage(result)
      console.log("message", message)
      return new Hub.ActionResponse({
        success: false,
        message,
      })
    }

    return new Hub.ActionResponse({ success: true })
  }

  async sendChunks(chunks: any[][]) {
    const result: Result = {
      skipped: [],
      leadErrors: [],
      campaignErrors: [],
    }
    let counter = 0
    for (const chunk of chunks) {
      counter++
      console.time(`chunk ${counter}`)
      await this.sendChunk(chunk, result)
      console.timeEnd(`chunk ${counter}`)
    }
    return result
  }

  async sendChunk(chunk: any[], result: any) {
    try {
      console.time("leadResponse")
      const leadResponse = await this.marketo.lead.createOrUpdate(chunk, { lookupField: this.lookupField })
      console.timeEnd("leadResponse")
      if (Array.isArray(leadResponse.errors)) {
        result.leadErrors = result.leadErrors.concat(leadResponse.errors)
      }

      const ids: any[] = []
      leadResponse.result.forEach((lead: any, i: number) => {
        if (lead.id) {
          ids.push({id: lead.id})
        } else {
          chunk[i].result = lead
          result.skipped.push(chunk[i])
        }
      })

      console.time("campaignResponse")
      const campaignResponse = await this.marketo.campaign.request(this.campaignId, ids)
      console.timeEnd("campaignResponse")
      if (Array.isArray(campaignResponse.errors)) {
        result.campaignErrors = result.campaignErrors.concat(campaignResponse.errors)
      }

    } catch (err) {
      console.error(err)
    }
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

  private hasErrors(result: Result) {
    return (
      result.skipped.length
      || result.leadErrors.length
      || result.campaignErrors.length
      )
    }

    private getErrorMessage(result: Result) {
      const condensed: any = {}
      if (result.skipped.length) {
        condensed.skipped = result.skipped.map((item: any) => {
          // return email and first reason for each skipped item
          return {
            email: item.email,
            reason: item.result.reasons[0].message,
          }
        })
      }
      if (result.leadErrors.length) {
        condensed.leadErrors = result.leadErrors
      }
      if (result.campaignErrors.length) {
        condensed.campaignErrors = result.campaignErrors
      }
      return JSON.stringify(condensed)
    }
}
