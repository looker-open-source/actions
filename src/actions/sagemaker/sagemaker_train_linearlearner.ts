import * as Hub from "../../hub"
import { THIRTY_SECONDS, TrainingJobPoller, Transaction } from "./training_job_poller"

import * as S3 from "aws-sdk/clients/s3"
import * as SageMaker from "aws-sdk/clients/sagemaker"
import { PassThrough } from "stream"
import * as winston from "winston"
import { linearLearnerHosts } from "./algorithm_hosts"
import { awsInstanceTypes } from "./aws_instance_types"
import { DEFAULT_REGION, logRejection } from "./utils"

const striplines = require("striplines")

export class SageMakerTrainLinearLearnerAction extends Hub.Action {

  name = "amazon_sagemaker_train_linearlearner"
  label = "Amazon SageMaker Train: Linear Learner"
  iconName = "sagemaker/sagemaker_train.png"
  description = "Start a training job on Amazon SageMaker, using the Linear Learner algorithm."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.Csv]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  usesStreaming = true
  requiredFields = []

  params = [
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
  ]

  async execute(request: Hub.ActionRequest) {

    // get string inputs
    const {
      modelName,
      bucket,
      awsInstanceType,
      predictorType,
    } = request.formParams

    const { roleArn } = request.params

    const { fields } = request.scheduledPlan!.query!
    if (! Array.isArray(fields)) {
      throw new Error("Unabled to access query fields.")
    }

    const featureDim = fields.length - 1

    // validate string inputs
    if (!modelName) {
      throw "Missing required param: modelName"
    }
    if (!bucket) {
      throw "Missing required param: bucket"
    }
    if (!awsInstanceType) {
      throw "Missing required param: awsInstanceType"
    }
    if (!predictorType) {
      throw "Missing required param: predictorType"
    }
    if (!roleArn) {
      throw "Missing required param: roleArn"
    }

    const jobName = this.getJobName(modelName)
    const numClasses = this.getNumericFormParam(request, "numClasses", 3, 1000000)
    const numInstances = this.getNumericFormParam(request, "numInstances", 1, 500)
    const epochs = this.getNumericFormParam(request, "epochs", 1, 1000000)
    const maxRuntimeInHours = this.getNumericFormParam(request, "maxRuntimeInHours", 1, 72)
    const maxRuntimeInSeconds = maxRuntimeInHours * 60 * 60

    try {
      // get region for bucket
      const region = await this.getBucketLocation(request, bucket)
      if (! region) {
        throw "Unable to determine bucket region."
      }

      // set up variables required for API calls
      const channelName = "train"
      const uploadKey = `${jobName}/${channelName}`

      // store data in S3 bucket
      await this.uploadToS3(request, bucket, uploadKey)

      // make createTrainingJob API call
      const sagemaker = this.getSageMakerClientFromRequest(request, region)

      const s3InputPath = `s3://${bucket}/${uploadKey}`
      const s3OutputPath = `s3://${bucket}`
      const trainingImageHost = linearLearnerHosts[region]
      const trainingImage = `${trainingImageHost}/linear-learner:1`

      // create hyperparameters
      const hyperParameters: SageMaker.HyperParameters = {
        predictor_type: predictorType,
        feature_dim: String(featureDim),
        epochs: String(epochs),
      }
      // num_class is only allowed for objective: multi:softmax
      if (predictorType === "multiclass_classifier") {
        hyperParameters.num_classes = String(numClasses)
      }

      const trainingParams = {
        TrainingJobName: jobName,
        RoleArn: roleArn,
        AlgorithmSpecification: { // required
          TrainingInputMode: "File", // required
          TrainingImage: trainingImage,
        },
        HyperParameters: hyperParameters,
        InputDataConfig: [
          {
            ChannelName: channelName, // required
            DataSource: { // required
              S3DataSource: { // required
                S3DataType: "S3Prefix", // required
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
      }
      winston.debug("trainingParams", trainingParams)

      const trainingResponse = await sagemaker.createTrainingJob(trainingParams).promise()
      winston.debug("trainingResponse", trainingResponse)

      // start polling for training job completion
      const transaction: Transaction = {
        request,
        sagemaker,
        modelName,
        jobName,
        maxRuntimeInSeconds,
        roleArn,
        trainingImage,
        pollIntervalInSeconds: THIRTY_SECONDS,
      }
      this.startPoller(transaction)

      // return success response
      return new Hub.ActionResponse({ success: true })

    } catch (err) {
      return new Hub.ActionResponse({ success: false, message: JSON.stringify(err) })
    }
  }

  async form(request: Hub.ActionRequest) {

    const buckets = await this.listBuckets(request)
    if (! Array.isArray(buckets)) {
      throw "Unable to retrieve buckets"
    }

    const form = new Hub.ActionForm()
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
            name: bucket.Name!,
            label: bucket.Name!,
          }
        }),
        default: buckets[0].Name,
        description: "The S3 bucket where SageMaker input training data should be stored",
      },
      {
        type: "select",
        label: "Predictor Type",
        name: "predictorType",
        required: true,
        options: [
          {
            name: "binary_classifier",
            label: "binary_classifier",
          },
          {
            name: "multiclass_classifier",
            label: "multiclass_classifier",
          },
          {
            name: "regressor",
            label: "regressor",
          },
        ],
        default: "binary_classifier",
        description: "The type of predictor to be performed.",
      },
      {
        type: "string",
        label: "Number of classes",
        name: "numClasses",
        default: "3",
        // tslint:disable-next-line max-line-length
        description: "The number of classifications. Valid values: 3 to 1000000. Required if predictor type is multiclass_classifier. Otherwise ignored.",
      },
      {
        type: "select",
        label: "AWS Instance Type",
        name: "awsInstanceType",
        required: true,
        options: awsInstanceTypes.map((type) => {
          return {
            name: type,
            label: type,
          }
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
        label: "Epochs",
        name: "epochs",
        default: "15",
        description: "The number of rounds to run. Valid values: 1 to 100000.",
      },
      {
        type: "string",
        label: "Maximum runtime in hours",
        name: "maxRuntimeInHours",
        default: "12",
        description: "Maximum allowed time for the job to run, in hours. Valid values: 1 to 72.",
      },
    ]
    return form
  }

  protected getSageMakerClientFromRequest(request: Hub.ActionRequest, region: string) {
    return new SageMaker({
      region,
      accessKeyId: request.params.accessKeyId,
      secretAccessKey: request.params.secretAccessKey,
    })
  }

  protected getS3ClientFromRequest(request: Hub.ActionRequest) {
    return new S3({
      accessKeyId: request.params.accessKeyId,
      secretAccessKey: request.params.secretAccessKey,
    })
  }

  private getJobName(modelName: string) {
    return `${modelName}-${Date.now()}`
  }

  private getNumericFormParam(request: Hub.ActionRequest, key: string, min: number, max: number) {
    const value = request.formParams[key]
    if (! value) {
      throw `Missing required param: ${key}.`
    }
    const num = Number(value)
    if (isNaN(num)) {
      throw `Missing required param: ${key}`
    }
    if (num < min || num > max) {
      throw `Param ${key}: ${value} is out of range: ${min} - ${max}`
    }
    return num
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
    if (response.LocationConstraint) {
      return response.LocationConstraint
    } else {
      return DEFAULT_REGION
    }
  }

  private async uploadToS3(request: Hub.ActionRequest, bucket: string, key: string) {
    return new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
      const s3 = this.getS3ClientFromRequest(request)

      function uploadFromStream() {
        const passthrough = new PassThrough()

        const params = {
          Bucket: bucket,
          Key: key,
          Body: passthrough,
        }
        s3.upload(params, (err: Error|null, data: S3.ManagedUpload.SendData) => {
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
      .catch(logRejection)
    })
  }

  private startPoller(transaction: Transaction) {
    new TrainingJobPoller(transaction)
  }

}

Hub.addAction(new SageMakerTrainLinearLearnerAction())
