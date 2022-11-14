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
    listAccessibleCustomers() {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "GET";
            const path = "customers:listAccessibleCustomers";
            return this.apiCall(method, path);
        });
    }
    searchOpenUserLists(clientCid, uploadKeyType) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    searchClientCustomers(clientCid) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    createUserList(targetCid, newListName, newListDescription, uploadKeyType, mobileAppId) {
        return __awaiter(this, void 0, void 0, function* () {
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
                            membership_life_span: 10000,
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
            return this.apiCall(method, path, body);
        });
    }
    createDataJob(targetCid, userListResourceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "POST";
            const path = `customers/${targetCid}/offlineUserDataJobs:create`;
            const body = {
                customer_id: targetCid,
                job: {
                    external_id: Date.now(),
                    type: "CUSTOMER_MATCH_USER_LIST",
                    customer_match_user_list_metadata: {
                        user_list: userListResourceName,
                    },
                },
            };
            return this.apiCall(method, path, body);
        });
    }
    addDataJobOperations(offlineUserDataJobResourceName, userIdentifiers) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "POST";
            const path = `${offlineUserDataJobResourceName}:addOperations`;
            const body = {
                resource_name: offlineUserDataJobResourceName,
                enable_partial_failure: true,
                operations: userIdentifiers,
            };
            return this.apiCall(method, path, body);
        });
    }
    runJob(offlineUserDataJobResourceName) {
        return __awaiter(this, void 0, void 0, function* () {
            const method = "POST";
            const path = `${offlineUserDataJobResourceName}:run`;
            const body = {
                resource_name: offlineUserDataJobResourceName,
            };
            return this.apiCall(method, path, body);
        });
    }
    apiCall(method, url, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const headers = {
                "developer-token": this.developerToken,
                "Authorization": `Bearer ${this.accessToken}`,
            };
            if (this.loginCid) {
                headers["login-customer-id"] = this.loginCid;
            }
            const response = yield gaxios.request({
                method,
                url,
                data,
                headers,
                baseURL: "https://googleads.googleapis.com/v11/",
            });
            if (process.env.ACTION_HUB_DEBUG) {
                const apiResponse = lodash.cloneDeep(response);
                error_utils_1.sanitizeError(apiResponse);
                this.log("debug", `Response from ${url}: ${JSON.stringify(apiResponse)}`);
            }
            return response.data;
        });
    }
}
exports.GoogleAdsApiClient = GoogleAdsApiClient;
