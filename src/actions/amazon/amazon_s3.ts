import * as Hub from "../../framework"

import * as S3 from "aws-sdk/clients/s3"

export class AmazonS3Action extends Hub.Action {

  constructor() {
    super()

    this.name = "amazon_s3"
    this.label = "Amazon S3"
    this.iconName = "amazon/amazon_s3.png"
    this.description = "Write data files to an S3 bucket."
    this.supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
    this.requiredFields = []
    this.params = [
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
  }

  async execute(request: Hub.ActionRequest) {
    return new Promise<Hub.ActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment.")
        return
      }

      if (!request.formParams || !request.formParams.bucket) {
        reject("Need Amazon S3 bucket.")
        return
      }

      const s3 = this.amazonS3ClientFromRequest(request)

      const filename = request.formParams.filename || request.suggestedFilename()

      if (!filename) {
        reject("Couldn't determine filename.")
        return
      }

      const params = {
        Bucket: request.formParams.bucket!,
        Key: filename,
        Body: request.attachment.dataBuffer,
      }

      s3.putObject(params, (err) => {
        if (err) {
          resolve(new Hub.ActionResponse({ success: false, message: err.message }))
        } else {
          resolve(new Hub.ActionResponse({ success: true }))
        }
      })
    })
  }

  async form(request: Hub.ActionRequest) {
    const promise = new Promise<Hub.ActionForm>((resolve, reject) => {
      const s3 = this.amazonS3ClientFromRequest(request)
      s3.listBuckets((err, res) => {
        if (err || !res.Buckets) {
          reject(err)
        } else {
          const form = new Hub.ActionForm()
          form.fields = [{
            label: "Bucket",
            name: "bucket",
            required: true,
            options: res.Buckets.map((c) => {
              return {name: c.Name!, label: c.Name!}
            }),
            type: "select",
            default: res.Buckets[0].Name,
          }, {
            label: "Path",
            name: "path",
            type: "string",
          }, {
            label: "Filename",
            name: "filename",
            type: "string",
          }]

          resolve(form)
        }
      })
    })
    return promise
  }

  protected amazonS3ClientFromRequest(request: Hub.ActionRequest) {
    return new S3(({
      region: request.params.region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    }))
  }

}
