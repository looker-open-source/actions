/* tslint:disable max-line-length */
import * as Hub from "../../hub"

import * as S3 from "aws-sdk/clients/s3"
import * as SageMaker from "aws-sdk/clients/sagemaker"
import { PassThrough } from "stream"
import * as winston from "winston"

const striplines = require("striplines")

import { ecrHosts } from "./algorithm_hosts"
import { awsInstanceTypes } from "./aws_instance_types"

function logJson(label: string, obj: any) {
  winston.debug(label, JSON.stringify(obj, null, 2))
}

export class SageMakerTrainAction extends Hub.Action {

  name = "amazon_sagemaker_train_xgboost"
  label = "Amazon SageMaker Train: Xgboost"
  iconName = "sagemaker/sagemaker_train.png"
  description = "Start a traingin job on Amazon SageMaker, using the Xgboost algorithm."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.Csv]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  usesStreaming = true
  requiredFields = []

  params = [
    {
      name: "access_key_id",
      label: "Access Key",
      required: true,
      sensitive: true,
      description: "Your access key for SageMaker.",
    }, {
      name: "secret_access_key",
      label: "Secret Key",
      required: true,
      sensitive: true,
      description: "Your secret key for SageMaker.",
    }, {
      name: "role_arn",
      label: "Role ARN",
      required: true,
      sensitive: false,
      description: "Role ARN for accessing SageMaker and S3",
    },
  ]

  async execute(request: Hub.ActionRequest) {

    const {role_arn} = request.params
    const {bucket, algorithm} = request.formParams

    winston.debug("request", JSON.stringify(request))
    winston.debug("request keys", Object.keys(request))

    try {
      // validate input
      if (!bucket) {
        throw new Error("Need Amazon S3 bucket.")
      }
      if (!algorithm) {
        throw new Error("Need SageMaker algorithm for training.")
      }
      // if (!trainingJobName) {
      //   throw new Error("Need SageMaker training job name.")
      // }
      if (!role_arn) {
        throw new Error("Need Amazon Role ARN for SageMaker & S3 Access.")
      }

      // get region for bucket
      const region = await this.getBucketLocation(request, bucket)
      if (! region) {
        throw new Error("Unable to determine bucket region.")
      }
      winston.debug("region", region)

      // set up variables required for API calls
      const channelName = "train"
      const date = Date.now()
      const prefix = `${algorithm}-${date}`
      const uploadKey = `${prefix}/${channelName}`

      // store data in S3 bucket
      await this.uploadToS3(request, bucket, uploadKey)

      // make createTrainingJob API call
      const sagemaker = this.getSageMakerClientFromRequest(request, region)

      const s3Uri = `s3://${bucket}/${prefix}/${channelName}`
      const s3OutputPath = `s3://${bucket}/${prefix}`
      const trainingImageHost = ecrHosts[algorithm][region]
      const trainingImagePath = `${trainingImageHost}/${algorithm}:1`
      winston.debug("s3Uri", s3Uri)
      winston.debug("s3OutputPath", s3OutputPath)

      const hyperParameters = await this.getHyperparameters(request)
      winston.debug("hyperParameters", hyperParameters)

      const trainingParams = {
        // should we ask the user to name the training job?
        TrainingJobName: `training-job-${date}`,
        RoleArn: role_arn,
        AlgorithmSpecification: { // required
          TrainingInputMode: "File", // required
          TrainingImage: trainingImagePath,
        },
        HyperParameters: hyperParameters,
        InputDataConfig: [
          {
            ChannelName: channelName, // required
            DataSource: { // required
              S3DataSource: { // required
                S3DataType: "S3Prefix", // required
                S3Uri: s3Uri, // required
              },
            },
            ContentType: "text/csv",
          },
        ],
        OutputDataConfig: {
          S3OutputPath: s3OutputPath,
        },
        ResourceConfig: {
          InstanceCount: 1,
          InstanceType: "ml.m4.xlarge",
          VolumeSizeInGB: 10,
        },
        StoppingCondition: {
          MaxRuntimeInSeconds: 43200,
        },
      }
      winston.debug("trainingParams", trainingParams)

      const trainingResponse = await sagemaker.createTrainingJob(trainingParams).promise()
      logJson("trainingResponse", trainingResponse)

      // return success response
      return new Hub.ActionResponse({ success: true })

    } catch (err) {
      winston.error(err)
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  async form(request: Hub.ActionRequest) {

    const buckets = await this.listBuckets(request)
    if (! Array.isArray(buckets)) {
      throw new Error("Unable to retrieve buckets")
    }

    const form = new Hub.ActionForm()
    form.fields = [
      {
        type: "string",
        label: "Training Job Name",
        name: "job_name",
        required: true,
        default: `TrainingJob-${Date.now()}`,
        description: "The name for this training job.",
      },
      {
        type: "select",
        label: "Bucket",
        name: "bucket",
        required: true,
        options: buckets.map((bucket) => {
          return {
            name: bucket.Name!,
            label: bucket.Name!,
          }
        }),
        description: "The S3 bucket where SageMaker input training data should be stored",
      },
      {
        type: "select",
        label: "Objective",
        name: "objective",
        required: true,
        options: [
          {
            name: "reg:linear",
            label: "reg:linear",
          },
          {
            name: "binary:logistic",
            label: "binary:logistic",
          },
          {
            name: "multi:softmax",
            label: "multi:softmax",
          },
        ],
        description: "The type of classification to be performed.",
      },
      {
        type: "string",
        label: "Number of classes",
        name: "num_class",
        default: "3",
        description: "The number of classifications. Valid values: 3 to 1000000. Required if objective is multi:softmax. Otherwise ignored.",
      },
      {
        type: "select",
        label: "AWS Instance Type",
        name: "aws_instance_type",
        required: true,
        options: awsInstanceTypes.map((type) => {
          return {
            name: type,
            label: type,
          }
        }),
        description: "The type of AWS instance to use. More info: More info: https://aws.amazon.com/sagemaker/pricing/instance-types",
      },
      {
        type: "string",
        label: "Number of instances",
        name: "num_instances",
        default: "1",
        description: "The number of instances to run. Valid values: 1 to 500.",
      },
      {
        type: "string",
        label: "Number of rounds",
        name: "num_round",
        default: "100",
        description: "The number of rounds to run. Valid values: 1 to 1000000.",
      },
      {
        type: "string",
        label: "Maximum runtime in hours",
        name: "max_runtime_in_hours",
        default: "12",
        description: "Maximum allowed time for the job to run, in hours. Valid values: 1 to 72.",
      },
    ]
    return form
  }

  protected getSageMakerClientFromRequest(request: Hub.ActionRequest, region: string) {
    return new SageMaker({
      region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    })
  }

  protected getS3ClientFromRequest(request: Hub.ActionRequest) {
    return new S3({
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    })
  }

  private async listBuckets(request: Hub.ActionRequest) {
    const s3 = this.getS3ClientFromRequest(request)
    const response = await s3.listBuckets().promise()
    return response.Buckets
  }

  private async getBucketLocation(request: Hub.ActionRequest, bucket: string) {
    const s3 = this.getS3ClientFromRequest(request)

    const params = {
      Bucket: bucket,
    }
    const response = await s3.getBucketLocation(params).promise()

    return response.LocationConstraint
  }

  private async uploadToS3(request: Hub.ActionRequest, bucket: string, key: string) {
    return new Promise((resolve, reject) => {
      const s3 = this.getS3ClientFromRequest(request)

      function uploadFromStream() {
        const passthrough = new PassThrough()

        const params = {
          Bucket: bucket,
          Key: key,
          Body: passthrough,
        }
        s3.upload(params, (err: any, data: any) => {
          if (err) {
            return reject(err)
          }
          resolve(data)
        })

        return passthrough
      }

      request.stream(async (readable) => {
        readable
          .pipe(striplines(1))
          .pipe(uploadFromStream())
      })
    })
  }

  private async getHyperparameters(_request: Hub.ActionRequest) {
    return {
      num_round: "100",
      objective: "binary:logistic",
    }
  }

}

Hub.addAction(new SageMakerTrainAction())
