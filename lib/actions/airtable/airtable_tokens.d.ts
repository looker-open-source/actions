import { TokenPayload } from "../../hub";
export declare class AirtableTokens extends TokenPayload {
    static fromJson(json: any): AirtableTokens;
    refresh_token: string;
    access_token: string;
    redirectUri?: string;
    constructor(refreshToken: string, accessToken: string, redirectUri?: string);
    asJson(): any;
    toJSON(): any;
}
