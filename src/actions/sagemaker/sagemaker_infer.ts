import * as Hub from "../../hub"

import * as S3 from "aws-sdk/clients/s3"
import * as SageMaker from "aws-sdk/clients/sagemaker"
// import { PassThrough } from "stream"
import * as winston from "winston"

// const striplines = require("striplines")

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
      name: "role_arn",
      label: "Role ARN",
      required: true,
      sensitive: false,
      description: "Role ARN for accessing SageMaker and S3",
    },
  ]

  async execute(_request: Hub.ActionRequest) {

    // const {role_arn} = request.params
    // const {bucket, algorithm} = request.formParams

    try {

      // return success response
      return new Hub.ActionResponse({ success: true })

    } catch (err) {
      winston.error(err)
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  async form(_request: Hub.ActionRequest) {

    // const s3 = this.getS3ClientFromRequest(request)
    // const s3Res = await s3.listBuckets().promise()
    // const buckets = s3Res.Buckets ? s3Res.Buckets : []
    // logJson("buckets", buckets)

    const form = new Hub.ActionForm()
    // form.fields = [
    //   {
    //     label: "Bucket",
    //     name: "bucket",
    //     required: true,
    //     options: buckets.map((bucket) => {
    //       return {
    //         name: bucket.Name!,
    //         label: bucket.Name!,
    //       }
    //     }),
    //     type: "select",
    //     description: "The S3 bucket where SageMaker input training data should be stored",
    //   },
    //   {
    //     label: "Algorithm",
    //     name: "algorithm",
    //     required: true,
    //     options: [
    //       {
    //         name: "xgboost",
    //         label: "XGBoost",
    //       },
    //       {
    //         name: "linearlearner",
    //         label: "Linear Learner",
    //       },
    //     ],
    //     type: "select",
    //     description: "The algorithm for SageMaker training",
    //   },
    // ]
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

  // private async getBucketLocation(request: Hub.ActionRequest, bucket: string) {
  //   const s3 = this.getS3ClientFromRequest(request)

  //   const params = {
  //     Bucket: bucket,
  //   }
  //   const response = await s3.getBucketLocation(params).promise()

  //   return response.LocationConstraint
  // }

  // private async uploadToS3(request: Hub.ActionRequest, bucket: string, key: string) {
  //   return new Promise((resolve, reject) => {
  //     const s3 = this.getS3ClientFromRequest(request)

  //     function uploadFromStream() {
  //       const passthrough = new PassThrough()

  //       const params = {
  //         Bucket: bucket,
  //         Key: key,
  //         Body: passthrough,
  //       }
  //       s3.upload(params, (err: any, data: any) => {
  //         if (err) {
  //           return reject(err)
  //         }
  //         resolve(data)
  //       })

  //       return passthrough
  //     }

  //     request.stream(async (readable) => {
  //       readable
  //         .pipe(striplines(1))
  //         .pipe(uploadFromStream())
  //     })
  //   })
  // }

}

Hub.addAction(new SageMakerInferAction())
