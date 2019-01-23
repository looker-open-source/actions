/* tslint:disable max-line-length */

import * as Hub from "../../hub"

import * as S3 from "aws-sdk/clients/s3"
import * as SageMaker from "aws-sdk/clients/sagemaker"
import { PassThrough } from "stream"
import * as winston from "winston"

const striplines = require("striplines")

function logJson(label: string, obj: any) {
  winston.debug(label, JSON.stringify(obj, null, 2))
}

export class SageMakerInferAction extends Hub.Action {

  name = "amazon_sagemaker_infer"
  label = "Amazon SageMaker Infer"
  iconName = "sagemaker/sagemaker_infer.png"
  description = "Perform an inference using Amazon SageMaker."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.Csv]
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
      name: "region",
      label: "Region",
      required: true,
      sensitive: false,
      description: "AWS Region accessing SageMaker",
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
    const {bucket, model} = request.formParams

    try {
      // validate input
      if (!bucket) {
        throw new Error("Need Amazon S3 bucket.")
      }
      if (!model) {
        throw new Error("Need Amazon SageMaker model.")
      }
      if (!role_arn) {
        throw new Error("Need Amazon Role ARN for SageMaker & S3 Access.")
      }

      // upload data to S3
      const date = Date.now()
      const prefix = `transform-job-${date}`
      const uploadKey = `${prefix}/transform-input`

      // store data in S3 bucket
      await this.uploadToS3(request, bucket, uploadKey)

      // create transform job
      const sagemaker = this.getSageMakerClientFromRequest(request)

      const s3Uri = `s3://${bucket}/${prefix}/transform-input`
      const s3OutputPath = `s3://${bucket}/${prefix}`
      winston.debug("s3Uri", s3Uri)
      winston.debug("s3OutputPath", s3OutputPath)

      const transformParams = {
        ModelName: model,
        TransformJobName: `transform-job-${date}`,
        TransformInput: {
          DataSource: {
            S3DataSource: {
              S3DataType: "S3Prefix", // required
              S3Uri: s3Uri, // required
            },
          },
          ContentType: "text/csv",
        },
        TransformOutput: {
          S3OutputPath: s3OutputPath,
        },
        TransformResources: {
          InstanceCount: 1,
          InstanceType: "ml.m4.xlarge",
        },
      }
      winston.debug("transformParams", transformParams)

      const transformResponse = await sagemaker.createTransformJob(transformParams).promise()
      logJson("transformResponse", transformResponse)

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

    const models = await this.listModels(request)
    if (! Array.isArray(models)) {
      throw new Error("Unable to retrieve models")
    }

    const form = new Hub.ActionForm()
    form.fields = [
      {
        label: "Bucket",
        name: "bucket",
        required: true,
        options: buckets.map((bucket) => {
          return {
            name: bucket.Name!,
            label: bucket.Name!,
          }
        }),
        type: "select",
        // default: buckets[0].Name, // DNR
        default: "looker-marketing-analysis", // DNR
        description: "The S3 bucket where inference data should be stored",
      },
      {
        label: "Model",
        name: "model",
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
        name: "stripColumns",
        required: true,
        options: [
          { name: "0", label: "None" },
          { name: "1", label: "First Column" },
          { name: "2", label: "First & Second Column" },
        ],
        type: "select",
        default: "0",
        description: "Columns to remove before running inference task. Columns must be first or second column in the data provided. Use this to remove key, target variable, or both.",
      },
    ]
    return form
  }

  protected getSageMakerClientFromRequest(request: Hub.ActionRequest) {
    return new SageMaker({
      region: request.params.region,
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

  private async listModels(request: Hub.ActionRequest) {
    const sagemaker = this.getSageMakerClientFromRequest(request)
    const response = await sagemaker.listModels().promise()
    return response.Models
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

}

Hub.addAction(new SageMakerInferAction())
