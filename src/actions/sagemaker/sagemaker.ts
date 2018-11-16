import * as Hub from "../../hub"

import * as SageMaker from "aws-sdk/clients/sagemaker"

export class SageMakerAction extends Hub.Action {

  name = "amazon_sagemaker"
  label = "Amazon SageMaker"
  iconName = "sagemaker/sagemaker.jpg"
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

  async form(_request: Hub.ActionRequest) {
    // const client = this.getSageMakerClientFromRequest(request)
    // const res = await s3.listBuckets().promise()
    // const buckets = res.Buckets ? res.Buckets : []
    const buckets: any[] = [
      { Name: "Bucket One" },
      { Name: "Bucket Two" },
    ]
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Bucket",
      name: "bucket",
      required: true,
      options: buckets.map((c) => {
        return { name: c.Name!, label: c.Name! }
      }),
      type: "select",
      default: buckets[0].Name,
    }, {
      label: "Path",
      name: "path",
      type: "string",
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]
    return form
  }

  protected getSageMakerClientFromRequest(request: Hub.ActionRequest) {
    return new SageMaker({
      region: request.params.region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    })
  }

}

Hub.addAction(new SageMakerAction())
