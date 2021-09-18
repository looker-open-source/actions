import { Tokens, CHUNK_SIZE } from "../campaigns/salesforce_campaigns";
import { sfdcConnFromRequest } from "../common/oauth_helper";
import * as Hub from "../../../hub";
import * as jsforce from "jsforce";

interface CampaignMember {
  ContactId?: string;
  LeadId?: string;
  CampaignId: string;
  Status?: string;
}

export class SalesforceCampaignsSendData {
  async sendData(
    request: Hub.ActionRequest,
    memberIds: string[],
    tokens: Tokens
  ) {
    // const sfdcConn = await salesforceLogin(request);
    const sfdcConn = await sfdcConnFromRequest(request, tokens);

    // with refresh token we can get new access token and update the state without forcing a re-login
    let newTokens = { ...tokens };
    sfdcConn.on("refresh", (newAccessToken: string) => {
      newTokens = {
        access_token: newAccessToken,
        refresh_token: sfdcConn.refreshToken,
      };
    });

    let campaignId: string;

    switch (request.formParams.create_or_append) {
      case "create":
        const newCampaign = await sfdcConn
          .sobject("Campaign")
          .create({ Name: request.formParams.campaign_name });

        if (!newCampaign.success) {
          throw new Error(
            `Campaign creation error: ${JSON.stringify(newCampaign.errors)}`
          );
        } else {
          campaignId = newCampaign.id;
        }

        break;
      case "append":
        campaignId = request.formParams.campaign_name!;
    }

    const memberType =
      request.formParams.member_type === "lead" ? "LeadId" : "ContactId";
    const memberList = memberIds.map((m) => {
      return {
        [memberType]: m,
        CampaignId: campaignId,
        Status: request.formParams.member_status,
      };
    });

    // POST request with sObject Collections to execute multiple records in a single request
    // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_composite_sobjects_collections_create.htm

    // The entire request (up to 200 records per chunk) counts as a single API call toward API limits.
    // This resource is available in API v42.0+ and later (released Spring 2018)

    // For Salesforce Professional and Enterprise, each organization receives a total of 1k API calls per-user in a 24-hour period
    // https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm

    // bottom limit = 1,000 requests * 200 members = 200,000 members in 24h period per user
    const memberGrouped = this.chunk(memberList, CHUNK_SIZE);

    let memberErrors: jsforce.ErrorResult[] = [];

    // jsforce uses function overloading for the create function, which causes issues resolving the
    // function signature as the compiler picks the first definition in declaration order, which is
    // a single record. Hence the need to use the 'any' type below
    const records: any = await Promise.all(
      // todo replicate promise.allSettled behaviour in ES6
      memberGrouped.map(async (m) => {
        return await sfdcConn.sobject("CampaignMember").create(m);
      })
    );

    records.map((group: jsforce.RecordResult[]) => {
      group.map((r) => {
        !r.success ? memberErrors.push(r) : null;
      });
    });

    if (memberErrors.length > 0) {
      const cleanErrors = memberErrors.map((members) =>
        members.errors.map((e: any) => {
          return {
            statusCode: e.statusCode,
            message: e.message,
          };
        })
      );
      throw new Error(JSON.stringify(cleanErrors));
    }

    return newTokens;
  }

  chunk(items: CampaignMember[], size: number) {
    const chunks = [];
    while (items.length) {
      chunks.push(items.splice(0, size));
    }
    return chunks;
  }
}
