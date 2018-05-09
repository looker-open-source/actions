import * as Hub from "../../hub"

import * as S3 from "aws-sdk/clients/s3"

export class AmazonS3Action extends Hub.Action {

  name = "amazon_s3"
  label = "Amazon S3"
  iconName = "amazon/amazon_s3.png"
  description = "Write data files to an S3 bucket."
  supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
  usesStreaming = true
  requiredFields = []
  params = [
    {
      name: "access_key_id",
      label: "Access Key",
      required: true,
      sensitive: true,
      description: "Your access key for S3.",
    }, {
      name: "secret_access_key",
      label: "Secret Key",
      required: true,
      sensitive: true,
      description: "Your secret key for S3.",
    }, {
      name: "region",
      label: "Region",
      required: true,
      sensitive: false,
      description: "S3 Region e.g. us-east-1, us-west-1, ap-south-1 from " +
        "http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region.",
    },
  ]

  async execute(request: Hub.ActionRequest) {

    if (!request.formParams || !request.formParams.bucket) {
      throw new Error("Need Amazon S3 bucket.")
    }

    const s3 = this.amazonS3ClientFromRequest(request)

    const filename = request.formParams.filename || request.suggestedFilename()

    if (!filename) {
      throw new Error("Couldn't determine filename.")
    }

    const bucket = request.formParams.bucket

    try {
      await request.stream(async (readable) => {
        const params = {
          Bucket: bucket,
          Key: filename,
          Body: readable,
        }
        return s3.upload(params).promise()
      })
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      return new Hub.ActionResponse({ success: false, message: err.message })
    }

  }

  async form(request: Hub.ActionRequest) {
    const s3 = this.amazonS3ClientFromRequest(request)
    const res = await s3.listBuckets().promise()
    const buckets = res.Buckets || []
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

  protected amazonS3ClientFromRequest(request: Hub.ActionRequest) {
    return new S3({
      region: request.params.region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    })
  }

}
