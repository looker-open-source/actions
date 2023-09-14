import * as Hub from "../../../hub";
import { SalesforceOauthHelper } from "../common/oauth_helper";
import { SalesforceCampaignsFormBuilder } from "./campaigns_form_builder";
import { SalesforceCampaignsSendData } from "./campaigns_send_data";
export declare const REDIRECT_URL: string;
export declare const FIELD_MAPPING: {
    sfdcMemberType: string;
    tag: string;
    fallbackRegex: RegExp;
}[];
export interface Tokens {
    access_token?: string;
    refresh_token?: string;
}
export interface Mapper {
    fieldname: string;
    sfdcMemberType: string;
}
export interface MemberIds extends Mapper {
    data: string[];
}
export declare class SalesforceCampaignsAction extends Hub.OAuthAction {
    readonly sfdcOauthHelper: SalesforceOauthHelper;
    readonly sfdcCampaignsFormBuilder: SalesforceCampaignsFormBuilder;
    readonly sfdcCampaignsSendData: SalesforceCampaignsSendData;
    name: string;
    label: string;
    iconName: string;
    description: string;
    params: {
        description: string;
        label: string;
        name: string;
        required: boolean;
        sensitive: boolean;
        user_attribute_name: string;
    }[];
    supportedActionTypes: Hub.ActionType[];
    requiredFields: {
        any_tag: string[];
    }[];
    supportedFormats: Hub.ActionFormat[];
    supportedDownloadSettings: Hub.ActionDownloadSettings[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    supportedFormattings: Hub.ActionFormatting[];
    usesOauth: boolean;
    minimumSupportedLookerVersion: string;
    /******** Constructor & Helpers ********/
    constructor(oauthClientId: string, oauthClientSecret: string, maxResults: number, chunkSize: number);
    /******** OAuth Endpoints ********/
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    oauthFetchInfo(urlParams: {
        [key: string]: string;
    }, redirectUri: string): Promise<void>;
    oauthCheck(_request: Hub.ActionRequest): Promise<boolean>;
    /******** Action Endpoints ********/
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
}
