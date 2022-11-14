export declare const API_VERSION = "v14.0";
export declare const API_BASE_URL: string;
export declare const CUSTOMER_LIST_SOURCE_TYPES: {
    USER_PROVIDED_ONLY: string;
    PARTNER_PROVIDED_ONLY: string;
    BOTH_USER_AND_PARTNER_PROVIDED: string;
};
export interface UserUploadSession {
    "session_id": number;
    "batch_seq": number;
    "last_batch_flag": boolean;
    "estimated_num_total"?: number;
}
export interface UserUploadPayload {
    "schema": string | string[];
    "data": string[] | string[][];
}
export interface UserFields {
    email?: string | null;
    phone?: string | null;
    birthYear?: string | null;
    birthMonth?: string | null;
    birthDay?: string | null;
    lastName?: string | null;
    firstName?: string | null;
    firstInitial?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    country?: string | null;
    madid?: string | null;
    externalId?: string | null;
    [key: string]: UserFields[keyof UserFields];
}
export declare const validFacebookHashCombinations: [(f: UserFields) => string, string][];
export default class FacebookCustomAudiencesApi {
    readonly accessToken: string;
    constructor(accessToken: string);
    pagingResults(url: string): Promise<any>;
    me(): Promise<any>;
    getAdAccounts(): Promise<{
        name: string;
        id: string;
    }[]>;
    getCustomAudiences(adAccountId: string): Promise<{
        name: string;
        id: string;
    }[]>;
    createCustomAudience(adAccountId: string, name: string, description?: string, customer_file_source?: any): Promise<string>;
    appendUsersToCustomAudience(customAudienceId: string, session: UserUploadSession, payload: UserUploadPayload): Promise<any>;
    replaceUsersInCustomAudience(customAudienceId: string, session: UserUploadSession, payload: UserUploadPayload): Promise<any>;
    apiCall(method: "GET" | "POST", url: string, data?: any): Promise<any>;
}
