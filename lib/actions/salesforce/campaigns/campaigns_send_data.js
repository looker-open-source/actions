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
exports.SalesforceCampaignsSendData = void 0;
const winston = require("winston");
const oauth_helper_1 = require("../common/oauth_helper");
class SalesforceCampaignsSendData {
    constructor(oauthClientId, oauthClientSecret, chunkSize) {
        this.oauthCreds = { oauthClientId, oauthClientSecret };
        this.chunkSize = chunkSize;
    }
    sendData(request, memberIds, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            const sfdcConn = yield (0, oauth_helper_1.sfdcConnFromRequest)(request, tokens, this.oauthCreds);
            let campaignId;
            switch (request.formParams.create_or_append) {
                case "create":
                    const newCampaign = yield sfdcConn
                        .sobject("Campaign")
                        .create({ Name: request.formParams.campaign_name });
                    if (!newCampaign.success) {
                        throw new Error(`Campaign creation error: ${JSON.stringify(newCampaign.errors)}`);
                    }
                    else {
                        campaignId = newCampaign.id;
                    }
                    break;
                case "append":
                    campaignId = request.formParams.campaign_name;
                    break;
                // case "replace": // TODO build out replace
            }
            const memberListColumns = memberIds.map((column) => column.data.map((id) => {
                return {
                    [column.sfdcMemberType]: id,
                    CampaignId: campaignId,
                    Status: request.formParams.member_status,
                };
            }));
            // flatten array of arrays into one big list
            const memberList = [].concat.apply([], memberListColumns);
            const memberCount = memberList.length;
            const memberGrouped = this.chunk(memberList, this.chunkSize);
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
            const records = yield Promise.all(memberGrouped.map((m) => __awaiter(this, void 0, void 0, function* () {
                return yield sfdcConn.sobject("CampaignMember").create(m);
            })));
            const cleanErrors = this.cleanErrors(records, memberGrouped);
            const summary = `Errors with ${cleanErrors.length} out of ${memberCount} members`;
            const errorSummary = `${summary}. ${JSON.stringify(cleanErrors)}`;
            winston.debug(errorSummary);
            const message = cleanErrors.length > 0 ? errorSummary : "";
            return { message, sfdcConn };
        });
    }
    chunk(items, size) {
        const chunks = [];
        while (items.length > 0) {
            chunks.push(items.splice(0, size));
        }
        return chunks;
    }
    getSfdcMemberId(record) {
        const memberType = Object.keys(record).filter((key) => !["CampaignId", "Status"].includes(key))[0];
        return record[memberType];
    }
    // filters results to only errors and returns simplified error object:
    // [
    //   { abc1: ["Already a campaign member."] },
    //   { abc2: ["Attempted to add an entity 'abc2' to a campaign 'xyz' more than once.", "Some other error message"] },
    //   ...
    // ]
    cleanErrors(records, memberGrouped) {
        const memberErrors = [];
        records.map((chunk, chunkIndex) => {
            chunk.map((result, index) => {
                !result.success
                    ? memberErrors.push({
                        memberId: this.getSfdcMemberId(memberGrouped[chunkIndex][index]),
                        errors: result,
                    })
                    : null;
            });
        });
        const cleanErrors = memberErrors.map((me) => {
            const memberMessage = me.errors.errors.map((e) => e.message);
            return { [me.memberId]: memberMessage };
        });
        return cleanErrors;
    }
}
exports.SalesforceCampaignsSendData = SalesforceCampaignsSendData;
