import * as Hub from "../../../hub";
import * as semver from "semver";
import * as jsforce from "jsforce";
import { SalesforceLoginHelper } from "../common/login_helper";

const TAGS = ["sfdc_contact_id", "sfdc_lead_id"];
const CHUNK_SIZE = 200; // number of records to send at once
const MAX_RESULTS = 4000; // for appending to existing campaigns

interface CampaignMember {
  ContactId?: string;
  LeadId?: string;
  CampaignId: string;
  Status?: string;
}

export class SalesforceCampaignsAction extends Hub.Action {
  // login helper
  readonly salesforceLoginHelper: SalesforceLoginHelper;

  constructor() {
    super();
    this.salesforceLoginHelper = new SalesforceLoginHelper();
  }

  name = "salesforce_campaigns";
  label = "Salesforce Campaigns";
  iconName = "salesforce/common/salesforce.png";
  description = "Add contacts or leads to Salesforce campaign.";
  params = [
    {
      description:
        "Salesforce domain name, e.g. https://MyDomainName.my.salesforce.com",
      label: "Salesforce domain",
      name: "salesforce_domain",
      required: true,
      sensitive: false,
    },
    {
      description: "Username for Salesforce account",
      label: "Salesforce Username",
      name: "salesforce_username",
      required: true,
      sensitive: false,
    },
    {
      description: "Password for Salesforce account",
      label: "Salesforce Password",
      name: "salesforce_password",
      required: true,
      sensitive: true,
    },
    {
      description: "Security token for Salesforce account",
      label: "Salesforce Security Token",
      name: "salesforce_security_token",
      required: true,
      sensitive: true,
    },
  ];
  supportedActionTypes = [Hub.ActionType.Query];
  requiredFields = [{ any_tag: TAGS }];
  supportedVisualizationFormattings = [
    Hub.ActionVisualizationFormatting.Noapply,
  ];
  supportedFormattings = [Hub.ActionFormatting.Unformatted];
  // todo stream results
  // todo support All Results vs Results in Table
  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream];
    } else {
      return [Hub.ActionFormat.JsonDetail];
    }
  };

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json.";
    }

    if (!(request.formParams.campaign_name && request.formParams.member_type)) {
      throw "Missing Salesforce campaign name or member type.";
    }

    const qr = request.attachment.dataJSON;
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format.";
    }

    const fields: any[] = [].concat(
      ...Object.keys(qr.fields).map((k) => qr.fields[k])
    );

    const identifiableFields = fields.filter(
      (f: any) => f.tags && f.tags.some((t: string) => TAGS.includes(t))
    );
    // todo if no tags, search field names for match as backup, if nothing, then throw error
    if (identifiableFields.length !== 1) {
      throw `Query requires 1 field tagged with: ${TAGS.join(" or ")}.`;
    }

    const memberIds = qr.data.map(
      (row: any) => row[identifiableFields[0].name].value
    );

    let response;

    try {
      await this.sendData(request, memberIds);
    } catch (e) {
      response = { success: false, message: e.message };
    }
    return new Hub.ActionResponse(response);
  }

  async sendData(request: Hub.ActionRequest, memberIds: string[]) {
    const client = await this.salesforceLoginHelper.salesforceLogin(request);

    let campaignId: string;

    switch (request.formParams.create_or_append) {
      case "create":
        const newCampaign = await client
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

    // POST request with sObject Collections to execute actions on multiple records in a single request
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
        return await client.sobject("CampaignMember").create(m);
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
  }

  chunk(items: CampaignMember[], size: number) {
    const chunks = [];
    while (items.length) {
      chunks.push(items.splice(0, size));
    }
    return chunks;
  }

  async getCampaigns(request: Hub.ActionRequest) {
    try {
      const client = await this.salesforceLoginHelper.salesforceLogin(request);
      const results: jsforce.QueryResult<any> = await client
        .query("SELECT Id, Name FROM Campaign ORDER BY Name")
        .run({ maxFetch: MAX_RESULTS });

      // When maxFetch option is not set, the default value (10,000) is applied.
      // If you really want to fetch more records than the default value, you should explicitly set the maxFetch value in your query.

      const campaigns = results.records.map((c) => {
        return { name: c.Id, label: c.Name };
      });
      return campaigns;
    } catch (e) {
      throw e;
    }
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm();

    form.fields = [
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
    ];

    if (Object.keys(request.formParams).length === 0) {
      return form;
    }

    switch (request.formParams.create_or_append) {
      case "create":
        form.fields.push({
          name: "campaign_name",
          label: "Campaign Name",
          description: "Identifying name for the campaign",
          type: "string",
          required: true,
        });
        break;
      case "append":
        const campaigns = await this.getCampaigns(request);
        form.fields.push({
          name: "campaign_name",
          label: "Campaign Name",
          description: "Identifying name for the campaign",
          type: "select",
          required: true,
          options: campaigns,
        });
        break;
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
        name: "member_status", // todo make this dynamic - https://developer.salesforce.com/docs/atlas.en-us.object_reference.meta/object_reference/sforce_api_objects_campaignmember.htm
        label: "Member Status",
        description: "The status of the campaign members: Responded or Sent",
        type: "select",
        options: [
          { name: "Sent", label: "Sent" },
          { name: "Responded", label: "Responded" },
        ],
        required: false,
      },
    ];
    form.fields.push(...memberFields);

    return form;
  }
}

Hub.addAction(new SalesforceCampaignsAction());
