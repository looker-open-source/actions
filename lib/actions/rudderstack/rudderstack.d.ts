import * as Hub from "../../hub";
import Analytics from "@rudderstack/rudder-sdk-node";
interface RudderFields {
    idFieldNames: string[];
    idField?: Hub.Field;
    userIdField?: Hub.Field;
    groupIdField?: Hub.Field;
    emailField?: Hub.Field;
    anonymousIdField?: Hub.Field;
}
export declare enum RudderTags {
    UserId = "user_id",
    RudderAnonymousId = "rudder_anonymous_id",
    Email = "email",
    RudderGroupId = "rudder_group_id"
}
export declare enum RudderCalls {
    Identify = "identify",
    Track = "track",
    Group = "group"
}
export declare class RudderAction extends Hub.Action {
    allowedTags: RudderTags[];
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
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
    requiredFields: {
        any_tag: RudderTags[];
    }[];
    executeInOwnProcess: boolean;
    supportedFormats: (request: Hub.ActionRequest) => Hub.ActionFormat[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    protected executeRudder(request: Hub.ActionRequest, rudderCall: RudderCalls): Promise<Hub.ActionResponse>;
    protected unassignedRudderFieldsCheck(rudderFields: RudderFields | undefined): void;
    protected taggedFields(fields: Hub.Field[], tags: string[]): Hub.Field[];
    protected taggedField(fields: any[], tags: string[]): Hub.Field | undefined;
    protected rudderFields(fields: Hub.Field[]): RudderFields;
    protected filterJson(jsonRow: any, rudderFields: RudderFields, fieldName: string): any;
    protected prepareRudderTraitsFromRow(row: Hub.JsonDetail.Row, fields: Hub.Field[], rudderFields: RudderFields, hiddenFields: string[], trackCall: boolean): any;
    protected rudderClientFromRequest(request: Hub.ActionRequest): Analytics;
    protected generateAnonymousId(): string;
}
export {};
