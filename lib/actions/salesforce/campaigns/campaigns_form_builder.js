"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesforceCampaignsFormBuilder = void 0;
const oauth_helper_1 = require("../common/oauth_helper");
class SalesforceCampaignsFormBuilder {
    constructor(oauthClientId, oauthClientSecret, maxResults) {
        this.oauthCreds = { oauthClientId, oauthClientSecret };
        this.maxResults = maxResults;
    }
    formBuilder(request, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            const sfdcConn = yield (0, oauth_helper_1.sfdcConnFromRequest)(request, tokens, this.oauthCreds);
            const fields = [
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
                return { fields, sfdcConn };
            }
            switch (request.formParams.create_or_append) {
                case "create":
                    fields.push({
                        name: "campaign_name",
                        label: "Campaign Name",
                        description: "Identifying name for the campaign",
                        type: "string",
                        required: true,
                    });
                    break;
                case "append":
                    const campaigns = yield this.getCampaigns(sfdcConn);
                    fields.push({
                        name: "campaign_name",
                        label: "Campaign Name",
                        description: "Identifying name for the campaign",
                        type: "select",
                        required: true,
                        options: campaigns,
                    });
                    break;
            }
            const statuses = yield this.getCampaignMemberStatuses(sfdcConn);
            const memberFields = [
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
                    description: 'Set this to "Yes" to surface any Salesforce errors with setting campaign members \
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
            ];
            fields.push(...memberFields);
            return { fields, sfdcConn };
        });
    }
    getCampaignMemberStatuses(sfdcConn) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield sfdcConn.describe("CampaignMember");
            const pickListValues = results.fields
                .filter((f) => f.name === "Status")[0]
                .picklistValues.filter((v) => v.active);
            const statuses = pickListValues.map((v) => {
                return { name: v.value, label: v.label ? v.label : v.value };
            });
            return statuses;
        });
    }
    getCampaigns(sfdcConn) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Promise.resolve(sfdcConn
                .query("SELECT Id, Name FROM Campaign ORDER BY Name")
                .run({ maxFetch: this.maxResults }));
            const campaigns = results.records.map((c) => {
                return { name: c.Id, label: c.Name };
            });
            return campaigns;
        });
    }
}
exports.SalesforceCampaignsFormBuilder = SalesforceCampaignsFormBuilder;
