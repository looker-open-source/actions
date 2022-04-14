import * as SageMaker from "aws-sdk/clients/sagemaker";
import * as nodemailer from "nodemailer";
import * as Hub from "../../hub";
export declare const FIVE_MINUTES: number;
export declare const THIRTY_SECONDS: number;
export interface Transaction {
    request: Hub.ActionRequest;
    sagemaker: SageMaker;
    modelName: string;
    jobName: string;
    roleArn: string;
    trainingImage: string;
    maxRuntimeInSeconds: number;
    pollIntervalInSeconds: number;
}
export declare class TrainingJobPoller {
    transporter: nodemailer.Transporter;
    intervalTimer: any;
    timeoutTimer: any;
    constructor(transaction: Transaction);
    pollTrainingJob(transaction: Transaction): Promise<void>;
    checkTrainingJob(transaction: Transaction): Promise<void>;
    stopPolling(): void;
    sendTrainingTimeoutEmail(transaction: Transaction): Promise<void>;
    sendTrainingFailedEmail(transaction: Transaction, response: SageMaker.DescribeTrainingJobResponse): Promise<void>;
    sendTrainingStoppedEmail(transaction: Transaction, response: SageMaker.DescribeTrainingJobResponse): Promise<void>;
    sendCreateModelSuccessEmail(transaction: Transaction, response: SageMaker.CreateModelOutput): Promise<void>;
    sendCreateModelFailureEmail(transaction: Transaction, response: SageMaker.CreateModelOutput): Promise<void>;
    createModel(transaction: Transaction, trainingResponse: SageMaker.DescribeTrainingJobResponse): Promise<void>;
}
