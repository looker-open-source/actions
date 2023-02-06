import * as oboe from "oboe"
import { Readable } from "stream"
import * as winston from "winston"
import * as Hub from "../../../hub"
import { FIELD_MAPPING, Mapper, MemberIds, TAGS, Tokens } from "../campaigns/salesforce_campaigns"
import { SalesforceOauthHelper } from "../common/oauth_helper"
import { SalesforceCampaignsSendData } from "./campaigns_send_data"

const BATCH_SIZE = 10 * 1000

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

  get message(): string {
    return this.sfResponseMessage
  }
  readonly log = winston.log
  readonly sfdcOauthHelper: SalesforceOauthHelper
  readonly sfdcCampaignsSendData: SalesforceCampaignsSendData
  readonly hubRequest: Hub.ActionRequest
  tokens: Tokens
  sfResponseMessage = ""

  private batchPromises: Promise<void>[] = []
  private batchQueue: any[] = []
  private currentRequest = "done"
  private rowQueue: any[] = []
  private mapper: Mapper[] = []
  private isMapperDetermined = false

  constructor(
    oauthClientId: string, oauthClientSecret: string, chunkSize: number, hubRequest: Hub.ActionRequest, tokens: Tokens,
  ) {
    this.sfdcOauthHelper = new SalesforceOauthHelper(oauthClientId, oauthClientSecret)
    this.sfdcCampaignsSendData = new SalesforceCampaignsSendData(oauthClientId, oauthClientSecret, chunkSize)
    this.hubRequest = hubRequest
    this.tokens = tokens
    this.mapper = []
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
      return
    }
    await Promise.all(this.batchPromises)
    this.log("info",
      `Streaming upload complete. Sent ${this.numBatches} batches (batch size = ${BATCH_SIZE})`,
    )
  }

  private async startAsyncParser(downloadStream: Readable) {
    return new Promise<void>((resolve, reject) => {
      oboe(downloadStream)
        .node({"!.fields": (fieldData: any) => {
          // we only pull fields data once in a separate listener. purely to determine the mapper
          this.log("debug", "Received stream data. Determining mapper from LookML field tags and regex.")

          if (!this.isMapperDetermined) {
            let combinedFields = [...fieldData.dimensions,
                                  ...fieldData.measures,
                                  ...fieldData.table_calculations]
            combinedFields = combinedFields.reduce((aggregator, field) => {
              aggregator[field.name] = {
                label: field.label,
                tags: field.tags,
              }
              return aggregator
            }, {})
            try {
              this.setMapperFromFields(combinedFields)
            } catch (error) {
              reject(error) // cleanly fail without crashing action hub
            }
          }
          return oboe.drop
        }, "!.*" : (row: any) => {
          this.handleRow(row)
          this.scheduleBatch()
          return oboe.drop
        },
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

  private  setMapperFromFields(combinedFields: any) {
    for (const fieldname of Object.keys(combinedFields)) {
      let matched = false
      const field = combinedFields[fieldname]
      if (field.tags && field.tags.length > 0) {
        for (const fieldTag of field.tags) {
          if (TAGS.filter((tag) => tag === fieldTag).length === 1) {
            const sfdcMemberType = FIELD_MAPPING.filter((fm) => fm.tag === fieldTag)[0].sfdcMemberType
            this.mapper.push({
              fieldname,
              sfdcMemberType,
            })
            this.log("debug", `matched '${fieldname}' to '${sfdcMemberType}' with tag '${fieldTag}'`)
            matched = true
            break
          }
        }
      }
      if (matched) { continue }
      for (const fm of FIELD_MAPPING) {
        if ( field.label.match(fm.fallbackRegex) ) {
          this.mapper.push({
            fieldname,
            sfdcMemberType: fm.sfdcMemberType,
          })
          this.log("debug", `matched '${fieldname}' to '${fm.sfdcMemberType}' with regex on label '${field.label}'`)
          matched = true
          break
        }
      }
      if (matched) { continue }
      this.log("debug", `no match for field '${fieldname}'`)
    }

    this.log("debug", `${this.mapper.length} fields matched: ${JSON.stringify(this.mapper)}`)
    if (this.mapper.length !== 0) {
      this.isMapperDetermined = true
    } else {
      const fieldMapping = FIELD_MAPPING.map((fm: any) => {
        fm.fallbackRegex = fm.fallbackRegex.toString()
        return fm
      })
      const message = `Query requires at least 1 field with a tag or regex match: ${JSON.stringify(fieldMapping)}`
      this.sfResponseMessage = message
      throw message
    }
  }

  private transformRow(row: any) {
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
    if ( !this.isMapperDetermined ) {
      return
    }
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
      this.log("error", "Could not get tokens or failed to update with refresh token.")
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
