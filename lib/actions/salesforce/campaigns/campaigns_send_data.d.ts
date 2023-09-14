import * as jsforce from "jsforce";
import * as Hub from "../../../hub";
import { MemberIds, Tokens } from "../campaigns/salesforce_campaigns";
interface CampaignMember {
    ContactId?: string;
    LeadId?: string;
    CampaignId: string;
    Status?: string;
}
export declare class SalesforceCampaignsSendData {
    readonly oauthCreds: {
        oauthClientId: string;
        oauthClientSecret: string;
    };
    readonly chunkSize: number;
    constructor(oauthClientId: string, oauthClientSecret: string, chunkSize: number);
    sendData(request: Hub.ActionRequest, memberIds: MemberIds[], tokens: Tokens): Promise<{
        message: string;
        sfdcConn: jsforce.Connection;
    }>;
    chunk(items: CampaignMember[], size: number): CampaignMember[][];
    getSfdcMemberId(record: CampaignMember): string | undefined;
    cleanErrors(records: any, memberGrouped: CampaignMember[][]): {
        [x: string]: any[];
    }[];
}
export {};
