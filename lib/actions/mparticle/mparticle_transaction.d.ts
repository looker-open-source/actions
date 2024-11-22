import * as Hub from "../../hub";
import { LookmlModelExploreField as ExploreField } from "../../api_types/lookml_model_explore_field";
interface Mapping {
    customAttributes?: object;
    dataEventAttributes?: object;
    deviceInfo?: object;
    eventName?: object;
    userAttributes?: object;
    userIdentities?: object;
}
interface MparticleBulkEvent {
    [key: string]: any;
}
export declare class MparticleTransaction {
    apiKey: string | undefined;
    apiSecret: string | undefined;
    eventType: string;
    environment: string;
    errors: any;
    userIdentities: {
        [key: string]: string;
    };
    dataEventAttributes: {
        [key: string]: string;
    };
    handleRequest(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    sendChunk(rows: Hub.JsonDetail.Row[], mapping: any): Promise<void>;
    protected createEvent(row: Hub.JsonDetail.Row, mapping: any): {
        events: {
            data: any;
            event_type: string;
        }[];
        user_attributes: any;
        user_identities: any;
        device_info: any;
        schema_version: number;
        environment: string;
    };
    protected containsUserIdentity(userIdentities: any): boolean;
    protected setEventType(dataType: string | undefined): "user_data" | "event_data";
    protected setEnvironment(env: string | undefined): string;
    protected createMappingFromFields(fields: any): Mapping;
    protected getTag(field: ExploreField): string;
    protected mapObject(mapping: any, field: ExploreField): void;
    protected postOptions(body: MparticleBulkEvent[]): {
        url: string;
        headers: {
            Authorization: string;
        };
        body: MparticleBulkEvent[];
        json: boolean;
        resolveWithFullResponse: boolean;
    };
}
export {};
