import * as jsforce from "jsforce";
import * as Hub from "../../../hub";
import { Tokens } from "../campaigns/salesforce_campaigns";
export declare class SalesforceCampaignsFormBuilder {
    readonly oauthCreds: {
        oauthClientId: string;
        oauthClientSecret: string;
    };
    readonly maxResults: number;
    constructor(oauthClientId: string, oauthClientSecret: string, maxResults: number);
    formBuilder(request: Hub.ActionRequest, tokens: Tokens): Promise<{
        fields: Hub.ActionFormField[];
        sfdcConn: jsforce.Connection;
    }>;
    getCampaignMemberStatuses(sfdcConn: jsforce.Connection): Promise<{
        name: string;
        label: string;
    }[]>;
    getCampaigns(sfdcConn: jsforce.Connection): Promise<{
        name: any;
        label: any;
    }[]>;
}
