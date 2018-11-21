import * as Hub from "../../hub"

import * as S3 from "aws-sdk/clients/s3"
import * as SageMaker from "aws-sdk/clients/sagemaker"
import * as winston from "winston"

import { ecrHosts } from "./algorithm_hosts"

function logJson(label: string, obj: any) {
  winston.debug(label, JSON.stringify(obj, null, 2))
}

export class SageMakerAction extends Hub.Action {

  name = "amazon_sagemaker"
  label = "Amazon SageMaker"
  iconName = "sagemaker/sagemaker.png"
  description = "Send training data to Amazon SageMaker."
  supportedActionTypes = [Hub.ActionType.Query]
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
      description: "S3 Region e.g. us-east-1, us-west-1, ap-south-1 from " +
        "http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region.",
    }, {
      name: "role_arn",
      label: "Role ARN",
      required: true,
      sensitive: false,
      description: "Role ARN for accessing SageMaker and S3",
    },
  ]

  async execute(request: Hub.ActionRequest) {

    const {region, role_arn} = request.params
    const {input_bucket, output_bucket, algorithm} = request.formParams

    // validate input
    if (!input_bucket) {
      throw new Error("Need Amazon S3 input bucket.")
    }
    if (!output_bucket) {
      throw new Error("Need Amazon S3 output bucket.")
    }
    if (!algorithm) {
      throw new Error("Need SageMaker algorithm for training.")
    }
    if (!region) {
      throw new Error("Need AWS region.")
    }
    if (!role_arn) {
      throw new Error("Need Amazon Role ARN for SageMaker & S3 Access.")
    }

    try {
      // set up variables required for API calls
      const channelName = "train"
      const date = Date.now()
      const prefix = `${algorithm}-${date}`

      // store data in input_bucket on S3
      const s3 = this.getS3ClientFromRequest(request)

      const storage = await request.stream(async (readable) => {
        const storageParams = {
          Bucket: input_bucket,
          Key: `${prefix}/${channelName}`,
          Body: readable,
        }
        return s3.upload(storageParams).promise()
      })
      logJson("storage", storage)

      // make createTrainingJob API call
      const sagemaker = this.getSageMakerClientFromRequest(request)

      const s3Uri = `s3://${input_bucket}/${prefix}/${channelName}`
      winston.debug("s3Uri", s3Uri)
      const s3OutputPath = `s3://${output_bucket}/${prefix}`
      winston.debug("s3OutputPath", s3OutputPath)

      const trainingImageHost = ecrHosts[algorithm][region]
      const trainingImagePath = `${trainingImageHost}/${algorithm}:1`

      const trainingParams = {
        // should we ask the user to name the training job?
        TrainingJobName: `training-job-${date}`,
        RoleArn: role_arn,
        AlgorithmSpecification: { // required
          TrainingInputMode: "File", // required
          TrainingImage: trainingImagePath,
        },
        InputDataConfig: [
          {
            ChannelName: channelName, // required
            DataSource: { // required
              S3DataSource: { // required
                S3DataType: "S3Prefix", // required
                S3Uri: s3Uri, // required
              },
            },
          },
        ],
        OutputDataConfig: {
          S3OutputPath: s3OutputPath,
        },
        ResourceConfig: {
          InstanceCount: 1,
          InstanceType: "ml.m4.xlarge",
          VolumeSizeInGB: 1,
        },
        StoppingCondition: {
          MaxRuntimeInSeconds: 43200,
        },
      }
      winston.debug("trainingParams", trainingParams)

      const result = await sagemaker.createTrainingJob(trainingParams).promise()
      logJson("result", result)

      // return success response
      return new Hub.ActionResponse({ success: true })

    } catch (err) {
      winston.error(err)
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  async form(request: Hub.ActionRequest) {

    const s3 = this.getS3ClientFromRequest(request)
    const s3Res = await s3.listBuckets().promise()
    const buckets = s3Res.Buckets ? s3Res.Buckets : []
    // logJson("buckets", buckets)

    const form = new Hub.ActionForm()
    form.fields = [
      {
        label: "Input Bucket",
        name: "input_bucket",
        required: true,
        options: buckets.map((bucket) => {
          return {
            name: bucket.Name!,
            label: bucket.Name!,
          }
        }),
        type: "select",
        description: "The S3 bucket where SageMaker input training data should be stored",
      },
      {
        label: "Output Bucket",
        name: "output_bucket",
        required: true,
        options: buckets.map((bucket) => {
          return {
            name: bucket.Name!,
            label: bucket.Name!,
          }
        }),
        type: "select",
        description: "The S3 bucket where SageMaker training result should be stored",
      },
      {
        label: "Algorithm",
        name: "algorithm",
        required: true,
        options: [
          {
            name: "xgboost",
            label: "XGBoost",
          },
          {
            name: "linearlearner",
            label: "Linear Learner",
          },
        ],
        type: "select",
        description: "The algorithm for SageMaker training",
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
      region: request.params.region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    })
  }

}

Hub.addAction(new SageMakerAction())
