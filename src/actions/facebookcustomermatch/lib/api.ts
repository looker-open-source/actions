import * as gaxios from "gaxios"
import * as winston from "winston"
import {sanitizeError} from "./util"

const API_BASE_URL = "https://graph.facebook.com/v11.0/"
export const customer_list_source_types = { // Used by Facebook for unknown purposes. Privacy? Probably not, huh. Currently hardcoded to USER_PROVIDED_ONLY
    USER_PROVIDED_ONLY: "USER_PROVIDED_ONLY",
    PARTNER_PROVIDED_ONLY: "PARTNER_PROVIDED_ONLY",
    BOTH_USER_AND_PARTNER_PROVIDED: "BOTH_USER_AND_PARTNER_PROVIDED"
}
export interface UserUploadSession {
    "session_id": number, 
    "batch_seq": number, 
    "last_batch_flag": boolean, 
    "estimated_num_total"?: number
}

export interface UserUploadPayload {
    "schema": string | string[],
    "data": string[] | string[][],
}

export interface UserFields {
    email?: string | null,
    phone?: string | null, // as 7705555555 with no spaces, dashes, zeros. add country code if country field is missing
    gender?: string | null, // m for male, f for female
    birthYear?: string | null, // YYYY format. i.e. 1900
    birthMonth?: string | null, // MM format. i.e. 01 for january
    birthDayOfMonth?: string | null, // DD format. i.e. 01
    birthday?: string | null, //YYYYMMDD
    lastName?: string | null,
    firstName?: string | null,
    firstInitial?: string | null,
    city?: string | null, // a-z only, lowercase, no punctuation, no whitespace, no special characters
    state?: string | null, // 2 character ANSI abbreviation code https://en.wikipedia.org/wiki/Federal_Information_Processing_Standard_state_code
    zip?: string | null, // in US i.e. 30008, in UK Area/District/Sector format
    country?: string | null, // 2 letter codes https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
    madid?: string | null, // all lowercase, keep hyphens 
    externalId?: string | null,
    [key: string]: UserFields[keyof UserFields]
}

// [transformFunction, the multikey name facebook expects to see]
export const validFacebookHashCombinations: [(f: UserFields) => string, string][] = [
    [(formattedRow: UserFields) => `${formattedRow.email}`, "EMAIL_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.phone}`, "PHONE_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.city}_${formattedRow.state}`, "LN_FN_CT_ST_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.zip}`, "LN_FN_ZIP_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.madid}`, "MADID_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.email}_${formattedRow.firstName}`, "EMAIL_FN_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.email}_${formattedRow.lastName}`, "EMAIL_LN_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.phone}_${formattedRow.firstName}`, "PHONE_FN_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.zip}_${formattedRow.birthYear}`, "LN_FN_ZIP_DOBY_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.city}_${formattedRow.state}_${formattedRow.birthYear}`, "LN_FN_CT_ST_DOBY_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstInitial}_${formattedRow.zip}`, "LN_FI_ZIP_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstInitial}_${formattedRow.city}_${formattedRow.state}`, "LN_FI_CT_ST_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstInitial}_${formattedRow.state}_${formattedRow.birthday}`, "LN_FI_ST_DOB_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.state}_${formattedRow.birthYear}`, "LN_FN_ST_DOBY_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.country}_${formattedRow.birthday}`, "LN_FN_COUNTRY_DOB_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.birthday}`, "LN_FN_DOB_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.externalId}`, "EXTERN_ID"],
  ]  

export default class FacebookCustomerMatchApi {
    readonly accessToken: string
    constructor(accessToken: string) {
        this.accessToken = accessToken
    }

    async me(): Promise<any> {
        return this.apiCall("GET", "me")
    }

    /*Sample response: 
    {
        "businesses": {
            "data": [
            {
                "id": "496949287383810",
                "name": "Cool Guys Moving LLC"
            },
            {
                "id": "104000277081747",
                "name": "Western Analytics"
            }
            ],
        }
        "paging": ...
        "id": "106332305032035"
    }*/
    async getBusinessAccountIds(): Promise<{name: string, id: string}[]> {
        const response = await this.apiCall("GET", "me?fields=businesses")
        const namesAndIds = response["businesses"].data.map((businessMetadata: any) => ({name: businessMetadata.name, id: businessMetadata.id}))
        return namesAndIds
    }

    /*
        Sample response:

        {
            "data": [
                {
                "name": "Test Ad Account 1",
                "account_id": "114108701688636",
                "id": "act_114108701688636"
                }
            ],
            "paging": {}
        }
    */
    async getAdAccountsForBusiness(businessId: string): Promise<{name: string, id: string}[]> {
        const addAcountsForBusinessUrl = `${businessId}/owned_ad_accounts?fields=name,account_id`
        const response = await this.apiCall("GET", addAcountsForBusinessUrl)
        const namesAndIds = response.data.map((adAccountMetadata: any) => ({name: adAccountMetadata.name, id: adAccountMetadata.account_id}))
        return namesAndIds
    }

    /*
        Sample response:
        {
        "data": [
            {
            "name": "My new Custom Audience",
            "id": "23837492450850533"
            }
        ],
        "paging":...
        }
    */
    async getCustomAudiences(adAccountId: string): Promise<{name: string, id: string}[]> {
        const customAudienceUrl = `act_${adAccountId}/customaudiences?fields=name`
        const response = await this.apiCall("GET", customAudienceUrl)
        const namesAndIds = response.data.map((customAudienceMetadata: any) => ({name: customAudienceMetadata.name, id: customAudienceMetadata.id}))
        return namesAndIds
    }

    async createCustomAudience(adAccountId: string, name: string, description:string = "", customer_file_source: any = customer_list_source_types.USER_PROVIDED_ONLY): Promise<string> {
        const createCustomAudienceUrl = `act_${adAccountId}/customaudiences`
        const response = await this.apiCall("POST", createCustomAudienceUrl, {
            name,
            description,
            customer_file_source,
            subtype: "CUSTOM"
        })
        return response.id
    }

    async appendUsersToCustomAudience(customAudienceId: string, session: UserUploadSession, payload: UserUploadPayload ) {
        const appendUrl = `${customAudienceId}/users`
        const response = await this.apiCall("POST", appendUrl, {
            session,
            payload,
        })
        return response
    }

    async replaceUsersInCustomAudience(customAudienceId: string, session: UserUploadSession, payload: UserUploadPayload ) {
        const replaceUrl = `${customAudienceId}/usersreplace`
        const response = await this.apiCall("POST", replaceUrl, {
            session,
            payload,
        })
        return response
    }


    async apiCall(method: "GET" | "POST", url: string, data?: any) {
        let queryParamCharacter = "?"
        if (url.indexOf("?") >= 0) { // don't use two question marks if the url already contains query parameters
            queryParamCharacter = "&"
        }
        const response = await gaxios.request<any>({
            method,
            url: url + `${queryParamCharacter}access_token=${this.accessToken}`,
            data,
            baseURL: API_BASE_URL,
        }).catch((err) => {
            sanitizeError(err)
            if(err && err.response && err.response.data && err.response.data.error && err.response.data.error.message) {
                // Note: these can still leak access tokens if facebook replies with: "400 bad request, here's what you sent me!". keep the logging at debug level
                winston.debug("Facebook error message was: " + err.response.data.error.message)
                winston.debug("Facebook user friendly message title was: " + err.response.data.error.error_user_title)
                winston.debug("Facebook user friendly message was: " + err.response.data.error.error_user_msg)
            }
            // Note that the access token is intentionally omitted from this log
            winston.error(`Error in network request ${method} ${url} with parameters: ${typeof data === 'object' && JSON.stringify(data)}.`)
        })
        

        return response && response.data
    }


}