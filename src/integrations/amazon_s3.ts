import * as D from "../framework"

const S3 = require("aws-sdk/clients/s3")

export class AmazonS3Integration extends D.Integration {

  constructor() {
    super()

    this.name = "amazon_s3"
    this.label = "Amazon S3"
    this.iconName = "amazon_s3.png"
    this.description = "Write data files to an S3 bucket."
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "access_key_id",
        label: "Access Key",
        required: true,
        description: "Your access key for S3.",
        type: "string",
      }, {
        name: "secret_access_key",
        label: "Secret Key",
        required: true,
        sensitive: true,
        description: "Your secret key for S3.",
        type: "string",
      }, {
        name: "region",
        label: "Region",
        required: true,
        description: "S3 Region e.g. us-east-1, us-west-1, ap-south-1 from " +
          "http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region.",
        default: "us-east-1",
        type: "select",
        options: [
          // http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region
          {name: "us-east-1", label: "US East (N. Virginia)"},
          {name: "us-east-2", label: "US East (Ohio)"},
          {name: "us-west-1", label: "US West (N. California)"},
          {name: "us-west-2", label: "US West (Oregon)"},
          {name: "ca-central-1", label: "Canada (Central)"},
          {name: "ap-south-1", label: "Asia Pacific (Mumbai)"},
          {name: "ap-northeast-2", label: "Asia Pacific (Seoul)"},
          {name: "ap-southeast-1", label: "Asia Pacific (Singapore)"},
          {name: "ap-southeast-2", label: "Asia Pacific (Sydney)"},
          {name: "ap-northeast-1", label: "Asia Pacific (Tokyo)"},
          {name: "eu-central-1", label: "EU (Frankfurt)"},
          {name: "eu-west-1", label: "EU (Ireland)"},
          {name: "eu-west-2", label: "EU (London)"},
          {name: "sa-east-1", label: "South America (São Paulo)"},
        ],
      },
    ]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment"
      }

      if (!request.formParams || !request.formParams.bucket) {
        throw "Need Amazon S3 bucket."
      }

      const s3 = this.amazonS3ClientFromRequest(request)

      const params = {
        Bucket: request.formParams.bucket,
        Key: request.formParams.filename ? request.formParams.filename : request.suggestedFilename(),
        Body: request.attachment.dataBuffer,
      }

      s3.putObject(params, (err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(new D.DataActionResponse())
        }
      })
    })
  }

  async form(request: D.DataActionRequest) {
    const promise = new Promise<D.DataActionForm>((resolve, reject) => {
      const s3 = this.amazonS3ClientFromRequest(request)
      s3.listBuckets(null, (err: any, res: any) => {
        if (err) {
          reject(err)
        } else {

          const form = new D.DataActionForm()
          form.fields = [{
            label: "Bucket",
            name: "bucket",
            required: true,
            options: res.Buckets.map((c: any) => {
                return {name: c.Name, label: c.Name}
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

  private amazonS3ClientFromRequest(request: D.DataActionRequest) {
    return new S3(({
      region: request.params.region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    }))
  }

}

D.addIntegration(new AmazonS3Integration())
