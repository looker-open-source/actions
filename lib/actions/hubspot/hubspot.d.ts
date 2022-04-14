import * as hubspot from "@hubspot/api-client";
import * as Hub from "../../hub";
import { RequiredField } from "../../hub";
export declare enum HubspotTags {
    ContactId = "hubspot_contact_id",
    CompanyId = "hubspot_company_id"
}
export declare enum HubspotCalls {
    Contact = "contact",
    Company = "company"
}
interface DefaultHubspotConstructorProps {
    name: string;
    label: string;
    description: string;
    call: HubspotCalls;
    tag: HubspotTags;
}
export declare class HubspotAction extends Hub.Action {
    name: string;
    label: string;
    description: string;
    call: HubspotCalls;
    tag: HubspotTags;
    requiredFields: RequiredField[];
    iconName: string;
    params: {
        description: string;
        label: string;
        name: string;
        required: boolean;
        sensitive: boolean;
    }[];
    supportedActionTypes: Hub.ActionType[];
    usesStreaming: boolean;
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    executeInOwnProcess: boolean;
    constructor({ name, label, description, call, tag, }: DefaultHubspotConstructorProps);
    supportedFormats: (request: Hub.ActionRequest) => Hub.ActionFormat[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    protected hubspotClientFromRequest(request: Hub.ActionRequest): hubspot.Client;
    protected taggedFields(fields: Hub.Field[], tags: string[]): Hub.Field[];
    protected getHubspotIdFieldName(fieldset: Hub.Field[]): string | undefined;
    /**
     * Returns the hubspot ID from the current row, given that one of the column dimensions
     * was tagged with the corresponding HubspotTag
     * @param fieldset Fieldset for the entire query
     * @param row The specific row to be processed
     */
    protected getHubspotIdFromRow(fieldset: Hub.Field[], row: Hub.JsonDetail.Row): string | undefined;
    protected executeHubspot(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
}
export {};
