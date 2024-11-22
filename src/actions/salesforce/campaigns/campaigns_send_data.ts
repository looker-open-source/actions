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

type MemberType = "ContactId" | "LeadId"

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
        campaignId = request.formParams.campaign_name!
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
    const memberGrouped = this.chunk(memberList, this.chunkSize)

    // POST request with sObject Collections to execute multiple records in a single request
    // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta
    // /api_rest/resources_composite_sobjects_collections_create.htm

    // The entire request (up to 200 records per chunk) counts as a single API call toward API limits.
    // This resource is available in API v42.0+ and later (released Spring 2018)

    // For Salesforce Professional and Enterprise, each organization receives a total
    // of 1k API calls per-user in a 24-hour period
    // https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta
    // /salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm

    // bottom limit = 1,000 requests * 200 members = 200,000 members in 24h period per user

    // jsforce uses function overloading for the create function, which causes issues resolving the
    // function signature as the compiler picks the first definition in declaration order, which is
    // a single record. Hence the need to use the 'any' type below
    const records: any = await Promise.all(
      memberGrouped.map(async (m) => {
        return await sfdcConn.sobject("CampaignMember").create(m)
      }),
    )

    const cleanErrors = this.cleanErrors(records, memberGrouped)
    const summary = `Errors with ${cleanErrors.length} out of ${memberCount} members`
    const errorSummary = `${summary}. ${JSON.stringify(cleanErrors)}`
    winston.debug(errorSummary)

    const message = cleanErrors.length > 0 ? errorSummary : ""
    return { message, sfdcConn }
  }

  chunk(items: CampaignMember[], size: number) {
    const chunks = []
    while (items.length > 0) {
      chunks.push(items.splice(0, size))
    }
    return chunks
  }

  getSfdcMemberId(record: CampaignMember) {
    const memberType =  Object.keys(record).filter((key) => !["CampaignId", "Status"].includes(key))[0] as MemberType
    return record[memberType]
  }

  // filters results to only errors and returns simplified error object:
  // [
  //   { abc1: ["Already a campaign member."] },
  //   { abc2: ["Attempted to add an entity 'abc2' to a campaign 'xyz' more than once.", "Some other error message"] },
  //   ...
  // ]
  cleanErrors(records: any, memberGrouped: CampaignMember[][]) {
    const memberErrors: MemberErrors[] = []

    records.map((chunk: jsforce.RecordResult[], chunkIndex: number) => {
      chunk.map((result, index) => {
        !result.success
          ? memberErrors.push({
              memberId: this.getSfdcMemberId(memberGrouped[chunkIndex][index])!,
              errors: result,
            })
          : null
      })
    })

    const cleanErrors = memberErrors.map((me) => {
      const memberMessage = me.errors.errors.map((e: any) => e.message)
      return { [me.memberId]: memberMessage }
    })
    return cleanErrors
  }
}
