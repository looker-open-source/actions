import * as jsforce from "jsforce"
import * as winston from "winston"
import * as Hub from "../../../hub"
import { MemberIds, Tokens } from "../campaigns/salesforce_campaigns"
import { sfdcConnFromRequest } from "../common/oauth_helper"

interface CampaignMember {
  ContactId?: string
  LeadId?: string
  CampaignId: string
  Status?: string
}

interface MemberErrors {
  memberId: string
  errors: jsforce.ErrorResult
}

export class SalesforceCampaignsSendData {
  readonly oauthCreds: { oauthClientId: string; oauthClientSecret: string }
  readonly chunkSize: number

  constructor(oauthClientId: string, oauthClientSecret: string, chunkSize: number) {
    this.oauthCreds = { oauthClientId, oauthClientSecret }
    this.chunkSize = chunkSize
  }

  async sendData(request: Hub.ActionRequest, memberIds: MemberIds[], tokens: Tokens) {
    const sfdcConn = await sfdcConnFromRequest(request, tokens, this.oauthCreds)
    let campaignId: string

    switch (request.formParams.create_or_append) {
      case "create":
        const newCampaign = await sfdcConn
          .sobject("Campaign")
          .create({ Name: request.formParams.campaign_name })

        if (!newCampaign.success) {
          throw new Error(
            `Campaign creation error: ${JSON.stringify(newCampaign.errors)}`,
          )
        } else {
          campaignId = newCampaign.id
        }
        break
      case "append":
        await sfdcConn
          .sobject("Campaign")
          .retrieve(request.formParams.campaign_name!, (error, account) => {
              if (error) {
                throw new Error(
                  `Campaign retrieve error: ${JSON.stringify(error)}`,
                )
              } else {
                campaignId = account.Id!
              }
            },
          )
        break
      // case "replace": // TODO build out replace
    }

    const memberListColumns = memberIds.map((column) =>
      column.data.map((id) => {
        return {
          [column.sfdcMemberType]: id,
          CampaignId: campaignId,
          Status: request.formParams.member_status,
        }
      }),
    )

    // flatten array of arrays into one big list
    const memberList = ([] as CampaignMember[]).concat.apply([], memberListColumns)
    const memberCount = memberList.length
    const records = await this.bulkInsert(memberList, sfdcConn, this.chunkSize)
    const cleanErrors = this.cleanErrors(records)
    const summary = `Errors with ${cleanErrors.length} out of ${memberCount} members`
    const errorSummary = `${summary}. ${JSON.stringify(cleanErrors)}`
    winston.debug(errorSummary)
    const message = cleanErrors.length > 0 ? errorSummary : ""
    return { message, sfdcConn }
  }

  async bulkInsert(items: CampaignMember[], sfdcConn: jsforce.Connection, chunkSize: number) {
    const bulkJob = sfdcConn.bulk.createJob("CampaignMember", "insert")
    const chunks: any = []
    while (items.length > 0) {
      chunks.push(items.splice(0, chunkSize))
    }
    return new Promise((resolve, reject) => {
      let completedChunks = 0
      const chunkCount = chunks.length
      const chunkResults: any  = []
      chunks.map((chunk: any) => {
          const batch = bulkJob.createBatch()
          batch.execute(chunk)
          batch.on("error", (batchError) => {
            const rejectReason = "Error loading data in salesforce, batchInfo: " + batchError
            winston.error(rejectReason)
            reject(rejectReason)
          })
          batch.on("queue", (batchInfo) => {
            winston.debug("queue, batchInfo:", batchInfo)
            batch.poll(1000, 200000)
          })
          batch.on("response", (rets) => {
            chunkResults.push(rets)
            completedChunks++
            winston.debug(`Completed chunk number ${completedChunks} out of  ${chunkCount} chunks`)
            if (completedChunks === chunkCount) {
              resolve(chunkResults)
            }
          })
        })
    })
  }

  // filters results to only errors and returns simplified error object:
  // [
  //   { abc1: ["Already a campaign member."] },
  //   { abc2: ["Attempted to add an entity 'abc2' to a campaign 'xyz' more than once.", "Some other error message"] },
  //   ...
  // ]
  cleanErrors(records: any) {
    const memberErrors: MemberErrors[] = []
    records.map((chunk: any, chunkIndex: number) => {
      chunk.map((result: any, resultIndex: number) => {
        if (!result.success) {
          memberErrors.push({
            memberId: result.id !== null ? result.id : chunkIndex.toString() + "." + resultIndex.toString() ,
            errors: result.errors.join(", "),
          })
        }
      })
    })
    const cleanErrors = memberErrors.map((me) => {
      return { [me.memberId]: me.errors }
    })
    return cleanErrors
  }
}
