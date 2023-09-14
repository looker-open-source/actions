import * as Hub from "../../hub";
import { AmazonS3Action } from "../amazon/amazon_s3";
import * as S3 from "aws-sdk/clients/s3";
export declare class DigitalOceanObjectStorageAction extends AmazonS3Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    params: {
        name: string;
        label: string;
        required: boolean;
        sensitive: boolean;
        description: string;
    }[];
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    protected amazonS3ClientFromRequest(request: Hub.ActionRequest): S3;
}
