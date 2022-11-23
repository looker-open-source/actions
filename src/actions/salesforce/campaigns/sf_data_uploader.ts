import * as oboe from "oboe"
import { Readable } from "stream"
import * as winston from "winston"
import * as Hub from "../../../hub"
import { Tokens } from "../campaigns/salesforce_campaigns"
import { SalesforceOauthHelper } from "../common/oauth_helper"
import { SalesforceCampaignsSendData } from "./campaigns_send_data"

const BATCH_SIZE = 10 * 1000

interface Mapper {
  fieldname: string
  sfdcMemberType: string
}

interface MemberIds extends Mapper {
  data: string[]
}

export class SalesforceCampaignDataUploader {

  private get batchIsReady() {
    return this.rowQueue.length >= BATCH_SIZE
  }

  private get numBatches() {
    return this.batchPromises.length
  }

  get updatedTokens() {
    return this.tokens
  }

  get message() : string {
    return this.sfResponseMessage
  }
  readonly log = winston.log
  readonly sfdcOauthHelper: SalesforceOauthHelper
  readonly sfdcCampaignsSendData: SalesforceCampaignsSendData
  readonly hubRequest: Hub.ActionRequest
  readonly FIELD_MAPPING = [
    { sfdcMemberType: "ContactId", tag: "sfdc_contact_id", fallbackRegex: new RegExp("contact id", "i") },
    { sfdcMemberType: "LeadId", tag: "sfdc_lead_id", fallbackRegex: new RegExp("lead id", "i") },
  ]
  readonly TAGS = this.FIELD_MAPPING.map((fm) => fm.tag)
  tokens: Tokens
  sfResponseMessage: string = ""

  private batchPromises: Promise<void>[] = []
  private batchQueue: any[] = []
  private currentRequest = "done"
  private rowQueue: any[] = []
  private fields: any[] = []
  private mapper: Mapper[] = []

  constructor(
    oauthClientId: string, oauthClientSecret: string, chunkSize: number, hubRequest: Hub.ActionRequest, tokens: Tokens,
  ) {
    this.sfdcOauthHelper = new SalesforceOauthHelper(oauthClientId, oauthClientSecret)
    this.sfdcCampaignsSendData = new SalesforceCampaignsSendData(oauthClientId, oauthClientSecret, chunkSize)
    this.hubRequest = hubRequest
    this.tokens = tokens
  }

  async run() {
    try {
      const streamingDownload = this.hubRequest.stream.bind(this.hubRequest)
      // The ActionRequest.prototype.stream() method is going to await the callback we pass
      // and either resolve the result we return here, or reject with an error from anywhere
      await streamingDownload(async (downloadStream: Readable) => {
        return this.startAsyncParser(downloadStream)
      })
    } catch (errorReport) {
      // TODO: the oboe fail() handler sends an errorReport object, but that might not be the only thing we catch
      this.log("error", "Streaming parse failure toString:", errorReport.toString())
      this.log("error", "Streaming parse failure JSON:", JSON.stringify(errorReport))
    }
    await Promise.all(this.batchPromises)
    this.log("info",
      `Streaming upload complete. Sent ${this.numBatches} batches (batch size = ${BATCH_SIZE})`,
    )
  }

  private async startAsyncParser(downloadStream: Readable) {
    return new Promise<void>((resolve, reject) => {
      oboe(downloadStream)
        .node("!.*", (row: any) => {
          this.handleRow(row)
          this.scheduleBatch()
          return oboe.drop
        })
        .done(() => {
          this.scheduleBatch(true)
          resolve()
        })
        .fail(reject)
    })
  }

  private handleRow(row: any) {
    const output = this.transformRow(row)
    if (output) {
      this.rowQueue.push(output)
    }
  }

  private setFieldsAndMapperFromRow(row: any) {
    this.fields = [].concat(
      ...Object.keys(row).map((k) => row[k]),
    )
    this.setMapperFromFields()
  }

  private setMapperFromFields() {
    this.fields.filter((f) =>
        f.tags && f.tags.some((t: string) =>
          this.TAGS.map((tag) => {
            if (tag === t) {
              this.mapper.push({
                fieldname: f.name,
                sfdcMemberType: this.FIELD_MAPPING.filter((fm) => fm.tag === t)[0].sfdcMemberType,
              })
            }
          }),
        ),
    )
    if (this.mapper.length < this.fields.length) {
      this.log("debug", `${this.mapper.length} out of ${this.fields.length} fields matched with tags, attemping regex`)
      this.fields.filter((f) => !this.mapper.map((m) => m.fieldname).includes(f.name))
        .map((f) => {
          for (const fm of this.FIELD_MAPPING) {
            this.log("debug", `testing ${fm.fallbackRegex} against ${f.label}`)
            if (fm.fallbackRegex.test(f.label)) {
              this.mapper.push({
                fieldname: f.name,
                sfdcMemberType: fm.sfdcMemberType,
              })
              break
            }
          }
        })
    }
    const mapperLength = this.mapper.length
    winston.debug(`${mapperLength} fields matched: ${JSON.stringify(this.mapper)}`)
    if (this.mapper.length === 0) {
      const fieldMapping = this.FIELD_MAPPING.map((fm: any) => {
        fm.fallbackRegex = fm.fallbackRegex.toString(); return fm
      })
      throw `Query requires at least 1 field with a tag or regex match: ${JSON.stringify(fieldMapping)}`
    }
  }

  private transformRow(row: any) {
    if (row.dimensions && row.measures) {
      this.setFieldsAndMapperFromRow(row.dimensions)
      return null
    }
    const memberIds: MemberIds[] = []
    if (Array.isArray(row)) {
      this.mapper.forEach((m) => {
        const dataArray = row.map((r: any) => r[m.fieldname].value)
        if (dataArray.length > 0) {
          memberIds.push({
            ...m,
            data: dataArray,
          })
        }
      })
    }
    if (memberIds.length === 0) {
      return null
    }
    return memberIds
  }

  private scheduleBatch(force = false) {
    if ( !this.batchIsReady && !force ) {
      return
    }
    const batch = this.rowQueue.splice(0, BATCH_SIZE - 1)
    this.batchQueue.push(batch)
    this.batchPromises.push(this.sendBatch())
    this.log("debug", `Sent batch number: ${this.numBatches}`)
  }

  private async checkTokens() {
    if (!this.hubRequest.params.state_json) {
      throw "Request is missing state_json."
    }
    let tokens: Tokens
    try {
      const stateJson = JSON.parse(this.hubRequest.params.state_json)
      if (stateJson.access_token && stateJson.refresh_token) {
        tokens = stateJson
      } else {
        tokens = await this.sfdcOauthHelper.getAccessTokensFromAuthCode(stateJson)
      }
      this.tokens = tokens
      return true
    } catch (error) {
      winston.error("Could not get tokens or failed to update with refresh token.")
      return false
    }
  }

  private async sendBatch(): Promise<void> {
    if (this.currentRequest !== "done" || this.batchQueue.length === 0) {
      return
    }
    const tokensResponse = await this.checkTokens()
    if (tokensResponse) {
      const currentBatch = this.batchQueue.shift().flat(1)
      this.currentRequest = "in progress"
      const { message, sfdcConn } = await this.sfdcCampaignsSendData.sendData(
        this.hubRequest, currentBatch, this.tokens,
      )
      this.tokens = { access_token: sfdcConn.accessToken, refresh_token: sfdcConn.refreshToken }
      this.sfResponseMessage = this.sfResponseMessage.concat(message)
      this.currentRequest = "done"
      return this.sendBatch()
    }
  }

}
