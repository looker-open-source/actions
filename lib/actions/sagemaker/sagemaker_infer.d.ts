import * as Hub from "../../hub";
import * as S3 from "aws-sdk/clients/s3";
import * as SageMaker from "aws-sdk/clients/sagemaker";
export declare class SageMakerInferAction extends Hub.Action {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    supportedFormattings: Hub.ActionFormatting[];
    supportedVisualizationFormattings: Hub.ActionVisualizationFormatting[];
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
    protected getSageMakerClientFromRequest(request: Hub.ActionRequest): SageMaker;
    protected getS3ClientFromRequest(request: Hub.ActionRequest): S3;
    private getJobName;
    private getNumericFormParam;
    private listBuckets;
    private listModels;
    private uploadToS3;
}
