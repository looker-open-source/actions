import * as Hub from "../../hub"

import * as S3 from "aws-sdk/clients/s3"
import * as SageMaker from "aws-sdk/clients/sagemaker"

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

  async execute(_request: Hub.ActionRequest) {

    // if (!request.formParams.bucket) {
    //   throw new Error("Need Amazon S3 bucket.")
    // }

    // const s3 = this.amazonS3ClientFromRequest(request)

    // const filename = request.formParams.filename || request.suggestedFilename()

    // if (!filename) {
    //   throw new Error("Couldn't determine filename.")
    // }

    // const bucket = request.formParams.bucket

    // try {
    //   await request.stream(async (readable) => {
    //     const params = {
    //       Bucket: bucket,
    //       Key: filename,
    //       Body: readable,
    //     }
    //     return s3.upload(params).promise()
    //   })
    return new Hub.ActionResponse({ success: true })
    // } catch (err) {
    //   return new Hub.ActionResponse({ success: false, message: err.message })
    // }

  }

  async form(request: Hub.ActionRequest) {
    const sagemaker = this.getSageMakerClientFromRequest(request)
    const sagemakerRes = await sagemaker.listNotebookInstances().promise()
    const notebooks = sagemakerRes.NotebookInstances ? sagemakerRes.NotebookInstances : []

    const s3 = this.getS3ClientFromRequest(request)
    const s3Res = await s3.listBuckets().promise()
    const buckets = s3Res.Buckets ? s3Res.Buckets : []

    const form = new Hub.ActionForm()
    form.fields = [
      {
        label: "Notebook",
        name: "notebook",
        required: true,
        options: notebooks.map((notebook) => {
          return {
            name: notebook.NotebookInstanceArn!,
            label: notebook.NotebookInstanceName!,
          }
        }),
        type: "select",
        description: "Choose the notebook where training data should be sent",
      },
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
        options: [{
            name: "xgboost",
            label: "XGBoost",
          }],
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
