import * as Hub from "../../hub"

import * as S3 from "aws-sdk/clients/s3"
import * as SageMaker from "aws-sdk/clients/sagemaker"
import { PassThrough } from "stream"
import * as winston from "winston"
import { awsInstanceTypes } from "./aws_instance_types"
import { logRejection } from "./utils"

const stripLines = require("striplines")
const stripColumns = require("./strip_columns.js")

export class SageMakerInferAction extends Hub.Action {

  name = "amazon_sagemaker_infer"
  label = "Amazon SageMaker Infer"
  iconName = "sagemaker/sagemaker_infer.png"
  description = "Perform an inference using Amazon SageMaker."
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
      name: "region",
      label: "Region",
      required: true,
      sensitive: false,
      description: "AWS Region for accessing SageMaker",
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
    } = request.formParams

    const { roleArn } = request.params

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
    if (!roleArn) {
      throw "Missing required param: roleArn"
    }

    const numInstances = this.getNumericFormParam(request, "numInstances", 1, 500)
    const numStripColumns = this.getNumericFormParam(request, "numStripColumns", 0, 2)

    try {
      // upload data to S3
      const jobName = this.getJobName()
      const inputDataKey = `${jobName}/transform-input`
      const rawDataKey = `${jobName}/transform-raw`
      const outputDataKey = `${jobName}/transform-output`

      // store data in S3 bucket
      await this.uploadToS3(request, bucket, numStripColumns, inputDataKey, rawDataKey)

      // create transform job
      const client = this.getSageMakerClientFromRequest(request)

      const s3InputPath = `s3://${bucket}/${inputDataKey}`
      const s3OutputPath = `s3://${bucket}/${outputDataKey}`
      winston.debug("s3InputPath", s3InputPath)
      winston.debug("s3OutputPath", s3OutputPath)

      const transformParams: SageMaker.CreateTransformJobRequest = {
        ModelName: modelName,
        TransformJobName: jobName,
        TransformInput: {
          DataSource: {
            S3DataSource: {
              S3DataType: "S3Prefix", // required
              S3Uri: s3InputPath, // required
            },
          },
          ContentType: "text/csv",
        },
        TransformOutput: {
          S3OutputPath: s3OutputPath,
        },
        TransformResources: {
          InstanceCount: numInstances,
          InstanceType: awsInstanceType,
        },
      }
      winston.debug("transformParams", transformParams)

      const transformResponse = await client.createTransformJob(transformParams).promise()
      winston.debug("transformResponse", transformResponse)

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

    const models = await this.listModels(request)
    if (! Array.isArray(models)) {
      throw "Unable to retrieve models"
    }

    const form = new Hub.ActionForm()
    form.fields = [
      {
        label: "Model",
        name: "modelName",
        required: true,
        options: models.map((model: any) => {
          return {
            name: model.ModelName,
            label: model.ModelName,
          }
        }),
        type: "select",
        description: "The S3 bucket where SageMaker input training data should be stored",
      },
      {
        label: "Strip Columns",
        name: "numStripColumns",
        required: true,
        options: [
          { name: "0", label: "None" },
          { name: "1", label: "First Column" },
          { name: "2", label: "First & Second Column" },
        ],
        type: "select",
        default: "0",
        // tslint:disable-next-line max-line-length
        description: "Columns to remove before running inference task. Columns must be first or second column in the data provided. Use this to remove key, target variable, or both.",
      },
      {
        label: "Output Bucket",
        name: "bucket",
        required: true,
        options: buckets.map((bucket) => {
          return {
            name: bucket.Name!,
            label: bucket.Name!,
          }
        }),
        type: "select",
        default: buckets[0].Name,
        description: "The S3 bucket where inference data should be stored",
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
    ]
    return form
  }

  protected getSageMakerClientFromRequest(request: Hub.ActionRequest) {
    return new SageMaker({
      region: request.params.region,
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

  private getJobName() {
    return `transform-job-${Date.now()}`
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

  private async listModels(request: Hub.ActionRequest) {
    const sagemaker = this.getSageMakerClientFromRequest(request)
    const response = await sagemaker.listModels().promise()
    return response.Models
  }

  private async uploadToS3(
    request: Hub.ActionRequest,
    bucket: string,
    numStripColumns: number,
    inputDataKey: string,
    rawDataKey: string,
  ) {
    return new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
      const s3 = this.getS3ClientFromRequest(request)

      function uploadFromStream(key: string) {
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
        // upload the inference data
        // without headers and strip columns if needed
        readable
          .pipe(stripLines(1))
          .pipe(stripColumns(numStripColumns))
          .pipe(uploadFromStream(inputDataKey))

        // upload the raw data
        readable
          .pipe(uploadFromStream(rawDataKey))
      })
      .catch(logRejection)
    })
  }

}

Hub.addAction(new SageMakerInferAction())
