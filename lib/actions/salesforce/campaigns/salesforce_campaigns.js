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
exports.SalesforceCampaignsAction = exports.FIELD_MAPPING = exports.REDIRECT_URL = void 0;
const winston = require("winston");
const Hub = require("../../../hub");
const oauth_helper_1 = require("../common/oauth_helper");
const campaigns_form_builder_1 = require("./campaigns_form_builder");
const campaigns_send_data_1 = require("./campaigns_send_data");
exports.REDIRECT_URL = `${process.env.ACTION_HUB_BASE_URL}/actions/salesforce_campaigns/oauth_redirect`;
exports.FIELD_MAPPING = [
    { sfdcMemberType: "ContactId", tag: "sfdc_contact_id", fallbackRegex: new RegExp("contact id", "i") },
    { sfdcMemberType: "LeadId", tag: "sfdc_lead_id", fallbackRegex: new RegExp("lead id", "i") },
];
const TAGS = exports.FIELD_MAPPING.map((fm) => fm.tag);
class SalesforceCampaignsAction extends Hub.OAuthAction {
    // TODO: support All Results vs Results in Table
    // TODO: stream results
    /******** Constructor & Helpers ********/
    constructor(oauthClientId, oauthClientSecret, maxResults, chunkSize) {
        super();
        this.name = "salesforce_campaigns";
        this.label = "Salesforce Campaigns";
        this.iconName = "salesforce/common/salesforce.png";
        this.description = "Add contacts or leads to Salesforce campaign.";
        this.params = [
            {
                description: "Salesforce domain name, e.g. https://MyDomainName.my.salesforce.com",
                label: "Salesforce domain",
                name: "salesforce_domain",
                required: true,
                sensitive: false,
                user_attribute_name: "salesforce_campaigns_action_domain",
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.requiredFields = [{ any_tag: TAGS }];
        this.supportedFormats = [Hub.ActionFormat.JsonDetailLiteStream];
        this.supportedDownloadSettings = [Hub.ActionDownloadSettings.Push];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.usesOauth = true;
        this.minimumSupportedLookerVersion = "22.6.0";
        this.sfdcOauthHelper = new oauth_helper_1.SalesforceOauthHelper(oauthClientId, oauthClientSecret);
        this.sfdcCampaignsFormBuilder = new campaigns_form_builder_1.SalesforceCampaignsFormBuilder(oauthClientId, oauthClientSecret, maxResults);
        this.sfdcCampaignsSendData = new campaigns_send_data_1.SalesforceCampaignsSendData(oauthClientId, oauthClientSecret, chunkSize);
    }
    /******** OAuth Endpoints ********/
    oauthUrl(redirectUri, encryptedState) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sfdcOauthHelper.oauthUrl(redirectUri, encryptedState);
        });
    }
    oauthFetchInfo(urlParams, redirectUri) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sfdcOauthHelper.oauthFetchInfo(urlParams, redirectUri);
        });
    }
    oauthCheck(_request) {
        return __awaiter(this, void 0, void 0, function* () {
            // This part of Hub.OAuthAction is deprecated and unused
            return true;
        });
    }
    /******** Action Endpoints ********/
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(request.attachment && request.attachment.dataJSON)) {
                throw "No attached json.";
            }
            if (!(request.formParams.campaign_name)) {
                throw "Missing Salesforce campaign name.";
            }
            const dataJSON = request.attachment.dataJSON;
            if (!dataJSON.fields || !dataJSON.data) {
                throw "Request payload is an invalid format.";
            }
            if (!request.params.state_json) {
                throw "Request is missing state_json.";
            }
            const fields = [].concat(...Object.keys(dataJSON.fields).map((k) => dataJSON.fields[k]));
            const mapper = [];
            // first try to match fields by tag
            fields.filter((f) => f.tags && f.tags.some((t) => TAGS.map((tag) => {
                if (tag === t) {
                    mapper.push({
                        fieldname: f.name,
                        sfdcMemberType: exports.FIELD_MAPPING.filter((fm) => fm.tag === t)[0].sfdcMemberType,
                    });
                }
            })));
            if (mapper.length < fields.length) {
                winston.debug(`${mapper.length} out of ${fields.length} fields matched with tags, attemping regex`);
                fields.filter((f) => !mapper.map((m) => m.fieldname).includes(f.name))
                    .map((f) => {
                    for (const fm of exports.FIELD_MAPPING) {
                        winston.debug(`testing ${fm.fallbackRegex} against ${f.label}`);
                        if (fm.fallbackRegex.test(f.label)) {
                            mapper.push({
                                fieldname: f.name,
                                sfdcMemberType: fm.sfdcMemberType,
                            });
                            break;
                        }
                    }
                });
            }
            winston.debug(`${mapper.length} fields matched: ${JSON.stringify(mapper)}`);
            if (mapper.length === 0) {
                const fieldMapping = exports.FIELD_MAPPING.map((fm) => { fm.fallbackRegex = fm.fallbackRegex.toString(); return fm; });
                const e = `Query requires at least 1 field with a tag or regex match: ${JSON.stringify(fieldMapping)}`;
                return new Hub.ActionResponse({ success: false, message: e });
            }
            const memberIds = [];
            mapper.forEach((m) => {
                memberIds.push(Object.assign(Object.assign({}, m), { data: dataJSON.data.map((row) => row[m.fieldname].value) }));
            });
            let response = {};
            let tokens;
            try {
                const stateJson = JSON.parse(request.params.state_json);
                if (stateJson.access_token && stateJson.refresh_token) {
                    tokens = stateJson;
                }
                else {
                    tokens = yield this.sfdcOauthHelper.getAccessTokensFromAuthCode(stateJson);
                }
                // passing back connection object to handle access token refresh and update state
                const { message, sfdcConn } = yield this.sfdcCampaignsSendData.sendData(request, memberIds, tokens);
                // return a fail status to surface salesforce API errors in the response message
                // message will only be visible in Looker if we send a fail status
                if (request.formParams.surface_sfdc_errors === "yes") {
                    response.success = message.length === 0;
                }
                response.message = message;
                tokens = { access_token: sfdcConn.accessToken, refresh_token: sfdcConn.refreshToken };
                response.state = new Hub.ActionState();
                response.state.data = JSON.stringify(tokens);
            }
            catch (e) {
                response = { success: false, message: e.message };
            }
            return new Hub.ActionResponse(response);
        });
    }
    form(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            let tokens;
            // uncomment the below to force a state reset and redo oauth login
            // if (request.params.state_json) {
            //   form.state = new Hub.ActionState();
            //   form.state.data = "reset";
            //   return form;
            // }
            // state_json can be any of the four:
            //    1. first time user, an empty state: {},
            //    2. resetting state: 'reset'
            //    3. has auth code and redirect: {code: x, redirect, y}
            //    4. has access tokens:  {access_token: a, refresh_token: b}
            // scenarios 1 and 2 will show loginForm, 3 and 4 will show formBuilder
            if (request.params.state_json) {
                try {
                    const stateJson = JSON.parse(request.params.state_json);
                    if (stateJson.access_token && stateJson.refresh_token) {
                        tokens = stateJson;
                    }
                    else {
                        tokens = yield this.sfdcOauthHelper.getAccessTokensFromAuthCode(stateJson);
                        form.state = new Hub.ActionState();
                        form.state.data = JSON.stringify(tokens);
                    }
                    // passing back connection object to handle access token refresh and update state
                    const { fields, sfdcConn } = yield this.sfdcCampaignsFormBuilder.formBuilder(request, tokens);
                    form.fields = fields;
                    tokens = { access_token: sfdcConn.accessToken, refresh_token: sfdcConn.refreshToken };
                    form.state = new Hub.ActionState();
                    form.state.data = JSON.stringify(tokens);
                    return form;
                }
                catch (e) {
                    winston.debug(e.toString());
                }
            }
            // login form will be displayed if any errrors occur while fetching and building form
            const loginForm = yield this.sfdcOauthHelper.makeLoginForm(request);
            return loginForm;
        });
    }
}
exports.SalesforceCampaignsAction = SalesforceCampaignsAction;
// Client ID is Salesforce Consumer Key
// Client Secret is Salesforce Consumer Secret
// Max results is max number of objects to fetch. Used in the form builder to get existing campaigns (default is 10,000)
// Chunk size is the number of sObject sent per single request (limit is 200 records)
if (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET
    && process.env.SALESFORCE_MAX_RESULTS && process.env.SALESFORCE_CHUNK_SIZE) {
    const envMaxResults = parseInt(process.env.SALESFORCE_MAX_RESULTS + "", 10);
    const maxResults = Number.isInteger(envMaxResults) ? envMaxResults : 10000;
    const envChunkSize = parseInt(process.env.SALESFORCE_CHUNK_SIZE + "", 10);
    const chunkSize = Number.isInteger(envChunkSize) ? envChunkSize : 200;
    const sfdcCampaigns = new SalesforceCampaignsAction(process.env.SALESFORCE_CLIENT_ID, process.env.SALESFORCE_CLIENT_SECRET, maxResults, chunkSize);
    Hub.addAction(sfdcCampaigns);
}
else {
    winston.warn(`[Salesforce Campaigns] Action not registered because required environment variables are missing.`);
}
