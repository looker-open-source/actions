"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SageMakerTrainXgboostAction = void 0;
const Hub = require("../../hub");
const training_job_poller_1 = require("./training_job_poller");
const S3 = require("aws-sdk/clients/s3");
const SageMaker = require("aws-sdk/clients/sagemaker");
const stream_1 = require("stream");
const winston = require("winston");
const algorithm_hosts_1 = require("./algorithm_hosts");
const aws_instance_types_1 = require("./aws_instance_types");
const utils_1 = require("./utils");
const striplines = require("striplines");
class SageMakerTrainXgboostAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "amazon_sagemaker_train_xgboost";
        this.label = "Amazon SageMaker Train: Xgboost";
        this.iconName = "sagemaker/sagemaker_train.png";
        this.description = "Start a training job on Amazon SageMaker, using the Xgboost algorithm.";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.Csv];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.usesStreaming = true;
        this.requiredFields = [];
        this.params = [
            {
                name: "accessKeyId",
                label: "Access Key",
                required: true,
                sensitive: true,
                description: "Your access key for SageMaker.",
            },
            {
                name: "secretAccessKey",
                label: "Secret Key",
                required: true,
                sensitive: true,
                description: "Your secret key for SageMaker.",
            },
            {
                name: "roleArn",
                label: "Role ARN",
                required: true,
                sensitive: false,
                description: "Role ARN for accessing SageMaker and S3",
            },
            {
                name: "user_email",
                label: "Looker User Email",
                required: true,
                description: `
        Click the button on the right and select 'Email'.
        This is required for the action to send status emails
        when training or inference jobs are complete.
      `,
                sensitive: false,
            },
            {
                name: "smtpHost",
                label: "SMTP Host",
                required: true,
                sensitive: false,
                description: "Host for sending emails.",
            },
            {
                name: "smtpPort",
                label: "SMTP Port",
                required: true,
                sensitive: false,
                description: "Port for sending emails.",
            },
            {
                name: "smtpFrom",
                label: "SMTP From",
                required: true,
                sensitive: false,
                description: "From for sending emails.",
            },
            {
                name: "smtpUser",
                label: "SMTP User",
                required: true,
                sensitive: false,
                description: "User for sending emails.",
            },
            {
                name: "smtpPass",
                label: "SMTP Pass",
                required: true,
                sensitive: false,
                description: "Pass for sending emails.",
            },
        ];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            // get string inputs
            const { modelName, bucket, awsInstanceType, objective, } = request.formParams;
            const { roleArn } = request.params;
            // validate string inputs
            if (!modelName) {
                throw "Missing required param: modelName";
            }
            if (!bucket) {
                throw "Missing required param: bucket";
            }
            if (!awsInstanceType) {
                throw "Missing required param: awsInstanceType";
            }
            if (!objective) {
                throw "Missing required param: objective";
            }
            if (!roleArn) {
                throw "Missing required param: roleArn";
            }
            const jobName = this.getJobName(modelName);
            const numClass = this.getNumericFormParam(request, "numClass", 3, 1000000);
            const numInstances = this.getNumericFormParam(request, "numInstances", 1, 500);
            const numRounds = this.getNumericFormParam(request, "numRounds", 1, 1000000);
            const maxRuntimeInHours = this.getNumericFormParam(request, "maxRuntimeInHours", 1, 72);
            const maxRuntimeInSeconds = maxRuntimeInHours * 60 * 60;
            try {
                // get region for bucket
                const region = yield this.getBucketLocation(request, bucket);
                if (!region) {
                    throw "Unable to determine bucket region.";
                }
                // set up variables required for API calls
                const channelName = "train";
                const uploadKey = `${jobName}/${channelName}`;
                // store data in S3 bucket
                yield this.uploadToS3(request, bucket, uploadKey);
                // make createTrainingJob API call
                const sagemaker = this.getSageMakerClientFromRequest(request, region);
                const s3InputPath = `s3://${bucket}/${uploadKey}`;
                const s3OutputPath = `s3://${bucket}`;
                const trainingImageHost = algorithm_hosts_1.xgboostHosts[region];
                const trainingImage = `${trainingImageHost}/xgboost:1`;
                // create hyperparameters
                const hyperParameters = {
                    objective,
                    num_round: String(numRounds),
                };
                // num_class is only allowed for objective: multi:softmax
                if (objective === "multi:softmax") {
                    hyperParameters.num_class = String(numClass);
                }
                const trainingParams = {
                    TrainingJobName: jobName,
                    RoleArn: roleArn,
                    AlgorithmSpecification: {
                        TrainingInputMode: "File",
                        TrainingImage: trainingImage,
                    },
                    HyperParameters: hyperParameters,
                    InputDataConfig: [
                        {
                            ChannelName: channelName,
                            DataSource: {
                                S3DataSource: {
                                    S3DataType: "S3Prefix",
                                    S3Uri: s3InputPath, // required
                                },
                            },
                            ContentType: "text/csv",
                        },
                    ],
                    OutputDataConfig: {
                        S3OutputPath: s3OutputPath,
                    },
                    ResourceConfig: {
                        InstanceCount: numInstances,
                        InstanceType: awsInstanceType,
                        VolumeSizeInGB: 10,
                    },
                    StoppingCondition: {
                        MaxRuntimeInSeconds: maxRuntimeInSeconds,
                    },
                };
                winston.debug("trainingParams", trainingParams);
                const trainingResponse = yield sagemaker.createTrainingJob(trainingParams).promise();
                winston.debug("trainingResponse", trainingResponse);
                // start polling for training job completion
                const transaction = {
                    request,
                    sagemaker,
                    modelName,
                    jobName,
                    maxRuntimeInSeconds,
                    roleArn,
                    trainingImage,
                    pollIntervalInSeconds: training_job_poller_1.THIRTY_SECONDS,
                };
                this.startPoller(transaction);
                // return success response
                return new Hub.ActionResponse({ success: true });
            }
            catch (err) {
                return new Hub.ActionResponse({ success: false, message: JSON.stringify(err) });
            }
        });
    }
    form(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const buckets = yield this.listBuckets(request);
            if (!Array.isArray(buckets)) {
                throw "Unable to retrieve buckets";
            }
            const form = new Hub.ActionForm();
            form.fields = [
                {
                    type: "string",
                    label: "Model Name",
                    name: "modelName",
                    required: true,
                    description: "The name for model to be created after training is complete.",
                },
                {
                    type: "select",
                    label: "Bucket",
                    name: "bucket",
                    required: true,
                    options: buckets.map((bucket) => {
                        return {
                            name: bucket.Name,
                            label: bucket.Name,
                        };
                    }),
                    default: buckets[0].Name,
                    description: "The S3 bucket where SageMaker input training data should be stored",
                },
                {
                    type: "select",
                    label: "Objective",
                    name: "objective",
                    required: true,
                    options: [
                        {
                            name: "binary:logistic",
                            label: "binary:logistic",
                        },
                        {
                            name: "reg:linear",
                            label: "reg:linear",
                        },
                        {
                            name: "multi:softmax",
                            label: "multi:softmax",
                        },
                    ],
                    default: "binary:logistic",
                    description: "The type of classification to be performed.",
                },
                {
                    type: "string",
                    label: "Number of classes",
                    name: "numClass",
                    default: "3",
                    // tslint:disable-next-line max-line-length
                    description: "The number of classifications. Valid values: 3 to 1000000. Required if objective is multi:softmax. Otherwise ignored.",
                },
                {
                    type: "select",
                    label: "AWS Instance Type",
                    name: "awsInstanceType",
                    required: true,
                    options: aws_instance_types_1.awsInstanceTypes.map((type) => {
                        return {
                            name: type,
                            label: type,
                        };
                    }),
                    default: "ml.m4.xlarge",
                    // tslint:disable-next-line max-line-length
                    description: "The type of AWS instance to use. More info: More info: https://aws.amazon.com/sagemaker/pricing/instance-types",
                },
                {
                    type: "string",
                    label: "Number of instances",
                    name: "numInstances",
                    default: "1",
                    description: "The number of instances to run. Valid values: 1 to 500.",
                },
                {
                    type: "string",
                    label: "Number of rounds",
                    name: "numRounds",
                    default: "100",
                    description: "The number of rounds to run. Valid values: 1 to 1000000.",
                },
                {
                    type: "string",
                    label: "Maximum runtime in hours",
                    name: "maxRuntimeInHours",
                    default: "12",
                    description: "Maximum allowed time for the job to run, in hours. Valid values: 1 to 72.",
                },
            ];
            return form;
        });
    }
    getSageMakerClientFromRequest(request, region) {
        return new SageMaker({
            region,
            accessKeyId: request.params.accessKeyId,
            secretAccessKey: request.params.secretAccessKey,
        });
    }
    getS3ClientFromRequest(request) {
        return new S3({
            accessKeyId: request.params.accessKeyId,
            secretAccessKey: request.params.secretAccessKey,
        });
    }
    getJobName(modelName) {
        return `${modelName}-${Date.now()}`;
    }
    getNumericFormParam(request, key, min, max) {
        const value = request.formParams[key];
        if (!value) {
            throw `Missing required param: ${key}.`;
        }
        const num = Number(value);
        if (isNaN(num)) {
            throw `Missing required param: ${key}`;
        }
        if (num < min || num > max) {
            throw `Param ${key}: ${value} is out of range: ${min} - ${max}`;
        }
        return num;
    }
    listBuckets(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const s3 = this.getS3ClientFromRequest(request);
            const response = yield s3.listBuckets().promise();
            return response.Buckets;
        });
    }
    getBucketLocation(request, bucket) {
        return __awaiter(this, void 0, void 0, function* () {
            const s3 = this.getS3ClientFromRequest(request);
            const params = {
                Bucket: bucket,
            };
            const response = yield s3.getBucketLocation(params).promise();
            if (response.LocationConstraint) {
                return response.LocationConstraint;
            }
            else {
                return utils_1.DEFAULT_REGION;
            }
        });
    }
    uploadToS3(request, bucket, key) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const s3 = this.getS3ClientFromRequest(request);
                function uploadFromStream() {
                    const passthrough = new stream_1.PassThrough();
                    const params = {
                        Bucket: bucket,
                        Key: key,
                        Body: passthrough,
                    };
                    s3.upload(params, (err, data) => {
                        if (err) {
                            return reject(err);
                        }
                        resolve(data);
                    });
                    return passthrough;
                }
                request.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                    readable
                        .pipe(striplines(1))
                        .pipe(uploadFromStream());
                }))
                    .catch(utils_1.logRejection);
            });
        });
    }
    startPoller(transaction) {
        new training_job_poller_1.TrainingJobPoller(transaction);
    }
}
exports.SageMakerTrainXgboostAction = SageMakerTrainXgboostAction;
Hub.addAction(new SageMakerTrainXgboostAction());
