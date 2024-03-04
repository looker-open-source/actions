import * as gaxios from "gaxios"
import * as winston from "winston"
import {formatFullDate, isNullOrUndefined, sanitizeError, sortCompare} from "./util"

export const API_VERSION = "v17.0"
export const API_BASE_URL = `https://graph.facebook.com/${API_VERSION}/`
export const CUSTOMER_LIST_SOURCE_TYPES = {
    // Used by Facebook for unknown purposes.
    USER_PROVIDED_ONLY: "USER_PROVIDED_ONLY",
    PARTNER_PROVIDED_ONLY: "PARTNER_PROVIDED_ONLY",
    BOTH_USER_AND_PARTNER_PROVIDED: "BOTH_USER_AND_PARTNER_PROVIDED",
}
export interface UserUploadSession {
    "session_id": number,
    "batch_seq": number,
    "last_batch_flag": boolean,
    "estimated_num_total"?: number,
}

export interface UserUploadPayload {
    "schema": string | string[],
    "data": string[] | string[][],
}

// formatting guide: https://developers.facebook.com/docs
// ... /marketing-api/audiences/guides/custom-audiences#hash
export interface UserFields {
    email?: string | null,
    phone?: string | null,
    birthYear?: string | null,
    birthMonth?: string | null,
    birthDay?: string | null,
    lastName?: string | null,
    firstName?: string | null,
    firstInitial?: string | null,
    city?: string | null,
    state?: string | null,
    zip?: string | null,
    country?: string | null,
    madid?: string | null,
    externalId?: string | null,
    [key: string]: UserFields[keyof UserFields],
}

/* tslint:disable */
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
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstInitial}_${formattedRow.state}_${getDateOfBirthFromUserFields(formattedRow)}`, "LN_FI_ST_DOB_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.state}_${formattedRow.birthYear}`, "LN_FN_ST_DOBY_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${formattedRow.country}_${getDateOfBirthFromUserFields(formattedRow)}`, "LN_FN_COUNTRY_DOB_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.lastName}_${formattedRow.firstName}_${getDateOfBirthFromUserFields(formattedRow)}`, "LN_FN_DOB_SHA256"],
    [(formattedRow: UserFields) => `${formattedRow.externalId}`, "EXTERN_ID"],
  ]
/* tslint:enable */
function getDateOfBirthFromUserFields(uf: UserFields): string | null {
    if (isNullOrUndefined(uf.birthDay) || isNullOrUndefined(uf.birthMonth) || isNullOrUndefined(uf.birthYear)) {
        return null
    }
    return formatFullDate(uf.birthDay + "", uf.birthMonth + "", uf.birthYear + "")
}

export default class FacebookCustomAudiencesApi {
    readonly accessToken: string
    constructor(accessToken: string) {
        this.accessToken = accessToken
    }

    async pagingResults(url: string): Promise<any> {
        let data: any = []
        let hasNext = true

        while (hasNext) {
            const response = await this.apiCall("GET", url)
            data = [...data, ...response.data]
            if (!response.paging || !response.paging.next) {
                hasNext = false
            } else {
                url = response.paging.next
                .replace(API_BASE_URL, "")
                .replace(/access_token=.+?&/, "")
            }
        }
        return data
    }

    async me(): Promise<any> {
        return this.apiCall("GET", "me")
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
            "paging": {
                "cursors": {
                    "before": "abcdef123",
                    "after": "abcdef456"
                },
                "previous": "https://graph.facebook.com...&before=abcdef123",
                "next": "https://graph.facebook.com...&after=abcdef456"
            }
        }
    */
    async getAdAccounts(): Promise<{name: string, id: string}[]> {
        const addAcountsUrl = `me/adaccounts?fields=name,account_id`
        const data = await this.pagingResults(addAcountsUrl)
        const namesAndIds = data
            .map((adAccountMetadata: any) => ({ name: adAccountMetadata.name, id: adAccountMetadata.account_id }))
            .sort(sortCompare)
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
            "paging": {
                "cursors": {
                    "before": "abcdef123",
                    "after": "abcdef456"
                },
                "previous": "https://graph.facebook.com...&before=abcdef123",
                "next": "https://graph.facebook.com...&after=abcdef456"
            }
        }
    */
    async getCustomAudiences(adAccountId: string): Promise<{name: string, id: string}[]> {
        const customAudienceUrl = `act_${adAccountId}/customaudiences?fields=name`
        const data = await this.pagingResults(customAudienceUrl)
        const namesAndIds = data
            .map((customAudienceMetadata: any) =>
            ({name: customAudienceMetadata.name, id: customAudienceMetadata.id}))
            .sort(sortCompare)
        return namesAndIds
    }

    /* tslint:disable */
    async createCustomAudience(adAccountId: string, name: string, description = "",
                               customer_file_source: any = CUSTOMER_LIST_SOURCE_TYPES.USER_PROVIDED_ONLY):
                               Promise<string> {
        const createCustomAudienceUrl = `act_${adAccountId}/customaudiences`
        const response = await this.apiCall("POST", createCustomAudienceUrl, {
            name,
            description,
            customer_file_source,
            subtype: "CUSTOM",
        })
        return response.id
    }
    /* tslint:enable */

    async appendUsersToCustomAudience(customAudienceId: string, session: UserUploadSession,
                                      payload: UserUploadPayload ) {
        const appendUrl = `${customAudienceId}/users`
        const response = await this.apiCall("POST", appendUrl, {
            session,
            payload,
        })
        return response
    }

    async replaceUsersInCustomAudience(customAudienceId: string, session: UserUploadSession,
                                       payload: UserUploadPayload ) {
        const replaceUrl = `${customAudienceId}/usersreplace`
        const response = await this.apiCall("POST", replaceUrl, {
            session,
            payload,
        })
        return response
    }

    async apiCall(method: "GET" | "POST", url: string, data?: any) {
        let queryParamCharacter = "?"
        if (url.indexOf("?") >= 0) {
            // don't use two question marks if the url already
            // contains query parameters
            queryParamCharacter = "&"
        }
        const response = await gaxios.request<any>({
            method,
            url: url + `${queryParamCharacter}access_token=${this.accessToken}`,
            data,
            baseURL: API_BASE_URL,
        }).catch((err) => {
            sanitizeError(err)
            if (err && err.response && err.response.data &&
                err.response.data.error && err.response.data.error.message) {
                // Note: these can still leak access tokens if facebook replies with:
                // "400 bad request, here's what you sent me!". keep the logging at debug level
                winston.debug("Facebook error message was: " + err.response.data.error.message)
                winston.debug("Facebook user friendly message title was: " +
                err.response.data.error.error_user_title)
                winston.debug("Facebook user friendly message was: " +
                err.response.data.error.error_user_msg)
            }
            // Note that the access token is intentionally omitted from this log
            winston.error(`Error in network request ${method} ${url}` +
            ` with parameters: ${typeof data === "object" && JSON.stringify(data)}.`)
        })

        return response && response.data
    }

}
