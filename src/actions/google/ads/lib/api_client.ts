import * as gaxios from "gaxios"
import * as lodash from "lodash"
import { sanitizeError as sanitize } from "../../common/error_utils"
import { Logger } from "../../common/logger"

export class GoogleAdsApiClient {

    constructor(readonly log: Logger, readonly accessToken: string
              , readonly developerToken: string, readonly loginCid?: string) {}

    async listAccessibleCustomers() {
        const method = "GET"
        const path = "customers:listAccessibleCustomers"
        return this.apiCall(method, path)
    }

    async searchOpenUserLists(clientCid: string, uploadKeyType: "MOBILE_ADVERTISING_ID" | "CONTACT_INFO") {
      const method = "POST"
      const path = `customers/${clientCid}/googleAds:searchStream`
      const body = {
        query:
          "SELECT user_list.id, user_list.name"
          + " FROM user_list"
          + " WHERE user_list.type = 'CRM_BASED'"
          + " AND user_list.read_only = FALSE"
          + " AND user_list.account_user_list_status = 'ENABLED'"
          + " AND user_list.membership_status = 'OPEN'"
          + ` AND user_list.crm_based_user_list.upload_key_type = '${uploadKeyType}'`,
      }
      return this.apiCall(method, path, body)
    }

    async searchClientCustomers(clientCid: string) {
      const method = "POST"
      const path = `customers/${clientCid}/googleAds:searchStream`
      const body = {
        query:
          `SELECT\
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
      }
      return this.apiCall(method, path, body)
    }

    async createUserList(targetCid: string, newListName: string, newListDescription: string, uploadKeyType: "MOBILE_ADVERTISING_ID" | "CONTACT_INFO", mobileAppId?: string) {
      const method = "POST"
      const path = `customers/${targetCid}/userLists:mutate`
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
      }

      return this.apiCall(method, path, body)
    }

    async createDataJob(targetCid: string, userListResourceName: string) {
      const method = "POST"
      const path = `customers/${targetCid}/offlineUserDataJobs:create`
      const body = {
        customer_id: targetCid,
        job: {
          external_id: Date.now(), // must be an Int64 so not very useful
          type: "CUSTOMER_MATCH_USER_LIST",
          customer_match_user_list_metadata: {
            user_list: userListResourceName,
          },
        },
      }

      return this.apiCall(method, path, body)
    }

    async addDataJobOperations(offlineUserDataJobResourceName: string, userIdentifiers: any[]) {
      const method = "POST"
      const path = `${offlineUserDataJobResourceName}:addOperations`
      const body = {
        resource_name: offlineUserDataJobResourceName,
        enable_partial_failure: true,
        operations: userIdentifiers,
      }

      return this.apiCall(method, path, body)
    }

    async runJob(offlineUserDataJobResourceName: string) {
      const method = "POST"
      const path = `${offlineUserDataJobResourceName}:run`
      const body = {
        resource_name: offlineUserDataJobResourceName,
      }

      return this.apiCall(method, path, body)
    }

    async apiCall(method: "GET" | "POST", url: string, data?: any) {
      const headers: any = {
        "developer-token": this.developerToken,
        "Authorization": `Bearer ${this.accessToken}`,
      }
      if (this.loginCid) {
        headers["login-customer-id"] = this.loginCid
      }
      const response = await gaxios.request<any>({
        method,
        url,
        data,
        headers,
        baseURL: "https://googleads.googleapis.com/v12/",
      })

      if (process.env.ACTION_HUB_DEBUG) {
        const apiResponse = lodash.cloneDeep(response)
        sanitize(apiResponse)
        this.log("debug", `Response from ${url}: ${JSON.stringify(apiResponse)}`)
      }

      return response.data
    }
}
