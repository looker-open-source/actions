import * as jsforce from "jsforce"
import * as Hub from "../../../hub"
import { MAX_RESULTS, Tokens } from "../campaigns/salesforce_campaigns"
import { sfdcConnFromRequest } from "../common/oauth_helper"

export class SalesforceCampaignsFormBuilder {
  readonly oauthCreds: { oauthClientId: string; oauthClientSecret: string }

  constructor(oauthClientId: string, oauthClientSecret: string) {
    this.oauthCreds = { oauthClientId, oauthClientSecret }
  }

  async formBuilder(request: Hub.ActionRequest, tokens: Tokens) {
    // const sfdcConn = await salesforceLogin(request);
    const sfdcConn = await sfdcConnFromRequest(request, tokens, this.oauthCreds)

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
    const statuses = await this.getCampaignMemberStatuses(sfdcConn)
    const memberFields: Hub.ActionFormField[] = [
      {
        name: "member_status",
        label: "Member Status",
        description: "The status of the campaign members",
        type: "select",
        options: statuses,
        required: false,
      },
      {
        name: "surface_sfdc_errors",
        label: "Surface Salesforce Errors In Looker",
        description:
          'Set this to "Yes" to surface any Salesforce errors with setting campaign members \
          in Looker\'s scheduled job status detail. This will record an Error in Looker\'s \
          scheduled job status, which is useful for troubleshooting errors on a member level. \
          Set this to "No" to ignore all errors related to campaign members (default). This \
          will record a Complete status, regardless if there were any errors setting campaign members.',
        type: "select",
        options: [
          { name: "yes", label: "Yes" },
          { name: "no", label: "No" },
        ],
        required: false,
        default: "no",
      },
    ]
    fields.push(...memberFields)
    return { fields, tokens: newTokens }
  }

  async getCampaignMemberStatuses(sfdcConn: jsforce.Connection) {
    const results = await sfdcConn.describe("CampaignMember")
    const pickListValues = results.fields
      .filter((f) => f.name === "Status")[0]
      .picklistValues!.filter((v) => v.active)

    const statuses = pickListValues.map((v) => {
      return { name: v.value, label: v.label ? v.label : v.value }
    })

    return statuses
  }

  async getCampaigns(sfdcConn: jsforce.Connection) {
    const results: jsforce.QueryResult<any> = await Promise.resolve(
      sfdcConn
        .query("SELECT Id, Name FROM Campaign ORDER BY Name")
        .run({ maxFetch: MAX_RESULTS }),
      // TODO: only display recent campaigns?
    )

    const campaigns = results.records.map((c) => {
      return { name: c.Id, label: c.Name }
    })

    return campaigns
  }
}
