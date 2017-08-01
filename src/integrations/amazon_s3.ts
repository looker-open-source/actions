import * as D from "../framework"
import * as winston from "winston"

// const AWS = require("aws-sdk")
const S3 = require("aws-sdk/clients/s3")

export class AmazonS3Integration extends D.Integration {

  constructor() {
    super()

    this.name = "amazon_s3"
    this.label = "Amazon S3"
    this.iconName = "amazon_s3.png"
    this.description = "Write files to an S3 bucket."
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = []
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment"
      }

      if (!request.formParams ||
        !request.formParams.access_key_id ||
        !request.formParams.secret_access_key ||
        !request.formParams.bucket ||
        !request.formParams.region) {
        throw "Need Amazon S3 access key, secret_key, bucket, region."
      }

      const s3 = this.amazonS3ClientFromRequest(request)

      const params = {
        Bucket: request.formParams.bucket,
        Key: request.suggestedFilename(),
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
    winston.info(`Form request for ${request}`)
    const form = new D.DataActionForm()
    form.fields = [{
      label: "Bucket",
      name: "bucket",
      required: true,
      type: "string",
    }, {
      label: "Optional Path",
      name: "path",
      type: "string",
    }, {
      label: "Access Key",
      name: "access_key_id",
      required: true,
      type: "string",
    }, {
      label: "Secret Key",
      name: "secret_access_key",
      required: true,
      type: "string",
    }, {
      label: "Region",
      name: "region",
      default: "us-east-1",
      options: [
        {name: "us-east-1", label: "US East (N. Virginia)"},
        {name: "us-east-2", label: "US East (Ohio)"},
        {name: "us-west-1", label: "US West (N. California)"},
        {name: "us-west-2", label: "US West (Oregon)"},
        {name: "ap-south-1", label: "Asia Pacific (Mumbai)"},
        {name: "ap-northeast-2", label: "Asia Pacific (Seoul)"},
        {name: "ap-southeast-1", label: "Asia Pacific (Singapore)"},
        {name: "ap-southeast-2", label: "Asia Pacific (Sydney)"},
        {name: "ap-northeast-1", label: "Asia Pacific (Tokyo)"},
        {name: "eu-central-1", label: "EU (Frankfurt)"},
        {name: "eu-west-1", label: "EU (Ireland)"},
        {name: "sa-east-1", label: "South America (São Paulo)"},
      ],
      required: true,
      type: "select",
    }]

    return form
  }

  private amazonS3ClientFromRequest(request: D.DataActionRequest) {
    // AWS.config.update({
    //   region: request.formParams.region,
    //   accessKeyId: request.formParams.access_key_id,
    //   secretAccessKey: request.formParams.secret_access_key,
    // })
    // return new AWS.S3()
    return new S3(({
      region: request.formParams.region,
      accessKeyId: request.formParams.access_key_id,
      secretAccessKey: request.formParams.secret_access_key,
    }))
  }

}

D.addIntegration(new AmazonS3Integration())
