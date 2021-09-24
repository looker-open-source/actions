import * as jsforce from "jsforce"
import * as Hub from "../../../hub"
import { MAX_RESULTS, Tokens } from "../campaigns/salesforce_campaigns"
import { sfdcConnFromRequest } from "../common/oauth_helper"

export class SalesforceCampaignsFormBuilder {
  async formBuilder(request: Hub.ActionRequest, tokens: Tokens) {
    // const sfdcConn = await salesforceLogin(request);
    const sfdcConn = await sfdcConnFromRequest(request, tokens)

    // with refresh token we can get new access token and update the state without forcing a re-login
    let newTokens = { ...tokens }
    sfdcConn.on("refresh", (newAccessToken: string) => {
      newTokens = {
        access_token: newAccessToken,
        refresh_token: sfdcConn.refreshToken,
      }
    })

    const fields: Hub.ActionFormField[] = [
      {
        name: "create_or_append",
        label: "Create or Append",
        description: "Create a new Campaign or append to an existing Campaign",
        type: "select",
        required: true,
        interactive: true,
        options: [
          {
            name: "create",
            label: "Create",
          },
          {
            name: "append",
            label: "Append",
          },
        ],
      },
    ]
    if (Object.keys(request.formParams).length === 0) {
      return { fields, tokens: newTokens }
    }
    switch (request.formParams.create_or_append) {
      case "create":
        fields.push({
          name: "campaign_name",
          label: "Campaign Name",
          description: "Identifying name for the campaign",
          type: "string",
          required: true,
        })
        break
      case "append":
        const campaigns = await this.getCampaigns(sfdcConn)
        fields.push({
          name: "campaign_name",
          label: "Campaign Name",
          description: "Identifying name for the campaign",
          type: "select",
          required: true,
          options: campaigns,
        })
        break
    }
    const memberFields: Hub.ActionFormField[] = [
      {
        name: "member_type",
        label: "Member Type",
        description: "The record type of the campaign members: Contact or Lead",
        type: "select",
        options: [
          { name: "contact", label: "Contact" },
          { name: "lead", label: "Lead" },
        ],
        required: true,
      },
      {
        // todo make this dynamic
        // https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta
        // /object_reference/sforce_api_objects_campaignmember.htm
        name: "member_status",
        label: "Member Status",
        description: "The status of the campaign members: Responded or Sent",
        type: "select",
        options: [
          { name: "Sent", label: "Sent" },
          { name: "Responded", label: "Responded" },
        ],
        required: false,
      },
    ]
    fields.push(...memberFields)
    return { fields, tokens: newTokens }
  }

  async getCampaigns(sfdcConn: jsforce.Connection) {
    const results: jsforce.QueryResult<any> = await Promise.resolve(
      sfdcConn
        .query("SELECT Id, Name FROM Campaign ORDER BY Name")
        .run({ maxFetch: MAX_RESULTS }),
    )

    // todo - return error back if user does not have access to campaigns, should return INVALID_TYPE

    const campaigns = results.records.map((c) => {
      return { name: c.Id, label: c.Name }
    })

    return campaigns
  }
}
