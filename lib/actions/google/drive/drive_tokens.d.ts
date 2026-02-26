import { TokenPayload } from "../../../hub";
export declare class DriveTokens extends TokenPayload {
    tokens: any;
    redirect: string;
    static fromJson(json: any): DriveTokens;
    constructor(tokens: any, redirect: string);
    asJson(): any;
}
