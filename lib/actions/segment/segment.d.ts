import * as Hub from "../../hub";
interface SegmentFields {
    idFieldNames: string[];
    idField?: Hub.Field;
    userIdField?: Hub.Field;
    groupIdField?: Hub.Field;
    emailField?: Hub.Field;
    anonymousIdField?: Hub.Field;
}
export declare enum SegmentTags {
    UserId = "user_id",
    SegmentAnonymousId = "segment_anonymous_id",
    Email = "email",
    SegmentGroupId = "segment_group_id"
}
export declare enum SegmentCalls {
    Identify = "identify",
    Track = "track",
    Group = "group"
}
export declare class SegmentAction extends Hub.Action {
    allowedTags: SegmentTags[];
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
        any_tag: SegmentTags[];
    }[];
    executeInOwnProcess: boolean;
    supportedFormats: (request: Hub.ActionRequest) => Hub.ActionFormat[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    protected executeSegment(request: Hub.ActionRequest, segmentCall: SegmentCalls): Promise<Hub.ActionResponse>;
    protected unassignedSegmentFieldsCheck(segmentFields: SegmentFields | undefined): void;
    protected taggedFields(fields: Hub.Field[], tags: string[]): Hub.Field[];
    protected taggedField(fields: any[], tags: string[]): Hub.Field | undefined;
    protected segmentFields(fields: Hub.Field[]): SegmentFields;
    protected filterJson(jsonRow: any, segmentFields: SegmentFields, fieldName: string): any;
    protected prepareSegmentTraitsFromRow(row: Hub.JsonDetail.Row, fields: Hub.Field[], segmentFields: SegmentFields, hiddenFields: string[], trackCall: boolean, groupCall: boolean): any;
    protected segmentClientFromRequest(request: Hub.ActionRequest): any;
    protected generateAnonymousId(): string;
}
export {};
