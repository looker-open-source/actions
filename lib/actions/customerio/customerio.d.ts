import { TrackClient } from "customerio-node";
import * as Hub from "../../hub";
interface CustomerIoFields {
    idFieldNames: string[];
    idField?: Hub.Field;
    userIdField?: Hub.Field;
    emailField?: Hub.Field;
}
export declare enum CustomerIoTags {
    UserId = "user_id",
    Email = "email"
}
export declare enum CustomerIoCalls {
    Identify = "identify",
    Track = "track"
}
export declare class CustomerIoAction extends Hub.Action {
    allowedTags: CustomerIoTags[];
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
    }[];
    minimumSupportedLookerVersion: string;
    supportedActionTypes: Hub.ActionType[];
    usesStreaming: boolean;
    extendedAction: boolean;
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    requiredFields: {
        any_tag: CustomerIoTags[];
    }[];
    executeInOwnProcess: boolean;
    supportedFormats: (request: Hub.ActionRequest) => Hub.ActionFormat[];
    form(): Promise<Hub.ActionForm>;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    protected executeCustomerIo(request: Hub.ActionRequest, customerIoCall: CustomerIoCalls): Promise<Hub.ActionResponse>;
    protected unassignedCustomerIoFieldsCheck(customerIoFields: CustomerIoFields | undefined): void;
    protected taggedFields(fields: Hub.Field[], tags: string[]): Hub.Field[];
    protected taggedField(fields: any[], tags: string[]): Hub.Field | undefined;
    protected customerIoFields(fields: Hub.Field[]): CustomerIoFields;
    protected filterJsonCustomerIo(jsonRow: any, customerIoFields: CustomerIoFields, fieldName: string): any;
    protected prepareCustomerIoTraitsFromRow(row: Hub.JsonDetail.Row, fields: Hub.Field[], customerIoFields: CustomerIoFields, hiddenFields: string[], event: any, context: any, lookerAttributePrefix: string): any;
    protected customerIoClientFromRequest(request: Hub.ActionRequest): TrackClient;
}
export {};
