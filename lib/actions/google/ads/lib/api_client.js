"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsApiClient = void 0;
const gaxios = require("gaxios");
const lodash = require("lodash");
const error_utils_1 = require("../../common/error_utils");
class GoogleAdsApiClient {
    constructor(log, accessToken, developerToken, loginCid) {
        this.log = log;
        this.accessToken = accessToken;
        this.developerToken = developerToken;
        this.loginCid = loginCid;
    }
    async listAccessibleCustomers() {
        const method = "GET";
        const path = "customers:listAccessibleCustomers";
        return this.apiCall(method, path);
    }
    async searchOpenUserLists(clientCid, uploadKeyType) {
        const method = "POST";
        const path = `customers/${clientCid}/googleAds:searchStream`;
        const body = {
            query: "SELECT user_list.id, user_list.name"
                + " FROM user_list"
                + " WHERE user_list.type = 'CRM_BASED'"
                + " AND user_list.read_only = FALSE"
                + " AND user_list.account_user_list_status = 'ENABLED'"
                + " AND user_list.membership_status = 'OPEN'"
                + ` AND user_list.crm_based_user_list.upload_key_type = '${uploadKeyType}'`,
        };
        return this.apiCall(method, path, body);
    }
    async searchClientCustomers(clientCid) {
        const method = "POST";
        const path = `customers/${clientCid}/googleAds:searchStream`;
        const body = {
            query: `SELECT\
            customer_client.client_customer\
            , customer_client.hidden\
            , customer_client.id\
            , customer_client.level\
            , customer_client.resource_name\
            , customer_client.test_account\
            , customer_client.descriptive_name\
            , customer_client.manager\
            , customer_client.status\
          FROM customer_client\
          WHERE customer_client.status NOT IN ('CANCELED', 'SUSPENDED')`,
        };
        return this.apiCall(method, path, body);
    }
    async createUserList(targetCid, newListName, newListDescription, uploadKeyType, mobileAppId) {
        const MAX_CUSTOMER_MATCH_MEMBERSHIP_LIFE_SPAN_DAYS = 540;
        const method = "POST";
        const path = `customers/${targetCid}/userLists:mutate`;
        const body = {
            customer_id: targetCid,
            operations: [
                {
                    create: {
                        name: newListName,
                        description: newListDescription,
                        membership_status: "OPEN",
                        membership_life_span: MAX_CUSTOMER_MATCH_MEMBERSHIP_LIFE_SPAN_DAYS,
                        crm_based_user_list: {
                            upload_key_type: uploadKeyType,
                            app_id: mobileAppId,
                            data_source_type: "FIRST_PARTY",
                        },
                    },
                },
            ],
            validate_only: false,
        };
        try {
            return await this.apiCall(method, path, body);
        }
        catch (error) {
            this.handleEuPoliticalError(error);
            throw error;
        }
    }
    async createDataJob(targetCid, userListResourceName, consentAdUserData, consentAdPersonalization) {
        const method = "POST";
        const path = `customers/${targetCid}/offlineUserDataJobs:create`;
        const consent = {
            ad_user_data: consentAdUserData,
            ad_personalization: consentAdPersonalization,
        };
        const body = {
            customer_id: targetCid,
            job: {
                external_id: Date.now(), // must be an Int64 so not very useful
                type: "CUSTOMER_MATCH_USER_LIST",
                customer_match_user_list_metadata: {
                    user_list: userListResourceName,
                    consent,
                },
            },
        };
        try {
            return await this.apiCall(method, path, body);
        }
        catch (error) {
            this.handleEuPoliticalError(error);
            throw error;
        }
    }
    async addDataJobOperations(offlineUserDataJobResourceName, userIdentifiers) {
        const method = "POST";
        const path = `${offlineUserDataJobResourceName}:addOperations`;
        const body = {
            resource_name: offlineUserDataJobResourceName,
            enable_partial_failure: true,
            operations: userIdentifiers,
        };
        return this.apiCall(method, path, body);
    }
    async runJob(offlineUserDataJobResourceName) {
        const method = "POST";
        const path = `${offlineUserDataJobResourceName}:run`;
        const body = {
            resource_name: offlineUserDataJobResourceName,
        };
        return this.apiCall(method, path, body);
    }
    async apiCall(method, url, data) {
        const headers = {
            "developer-token": this.developerToken,
            "Authorization": `Bearer ${this.accessToken}`,
        };
        if (this.loginCid) {
            headers["login-customer-id"] = this.loginCid;
        }
        const response = await gaxios.request({
            method,
            url,
            data,
            headers,
            baseURL: "https://googleads.googleapis.com/v22/",
        });
        if (process.env.ACTION_HUB_DEBUG) {
            const apiResponse = lodash.cloneDeep(response);
            (0, error_utils_1.sanitizeError)(apiResponse);
            this.log("debug", `Response from ${url}: ${JSON.stringify(apiResponse)}`);
        }
        return response.data;
    }
    /**
     * Inspects the error response for EU Political Advertising Declaration requirements.
     * Re-throws a customized error message if the specific Google Ads API error is found.
     */
    handleEuPoliticalError(error) {
        var _a, _b, _c, _d, _e, _f, _g;
        const gadsError = (_f = (_e = (_d = (_c = (_b = (_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.error) === null || _c === void 0 ? void 0 : _c.details) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.errors) === null || _f === void 0 ? void 0 : _f[0];
        if (((_g = gadsError === null || gadsError === void 0 ? void 0 : gadsError.errorCode) === null || _g === void 0 ? void 0 : _g.mutateError) === "EU_POLITICAL_ADVERTISING_DECLARATION_REQUIRED") {
            const message = "Action required: To use Customer Match for EU political advertising, " +
                "you must first complete the identity verification and " +
                "declare your intent in the Google Ads UI. " +
                "See: https://developers.google.com/google-ads/api/docs/api-policy/eu-par";
            this.log("error", `EU Political Advertising Error: ${message}`);
            error.message = message;
            error.name = "EU Political Advertising Error";
        }
    }
}
exports.GoogleAdsApiClient = GoogleAdsApiClient;
