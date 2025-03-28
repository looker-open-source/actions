import * as Hub from "../../hub";
import { S3Client } from "@aws-sdk/client-s3";
export declare class AmazonS3Action extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    usesStreaming: boolean;
    requiredFields: never[];
    params: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    protected amazonS3ClientFromRequest(request: Hub.ActionRequest): S3Client;
}
