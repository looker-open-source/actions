import * as D from "../../framework"

import {ec2Regions} from "./regions"

const EC2 = require("aws-sdk/clients/ec2")

export class AmazonEC2Integration extends D.Integration {

  tag = "aws_resource_id"

  constructor() {
    super()

    this.name = "aws_ec2"
    this.label = "AWS EC2"
    this.iconName = "amazon_ec2.png"
    this.description = "Stop an EC2 instance"
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
        description: "EC2 Region e.g. us-east-1, us-west-1, ap-south-1 from " +
          "http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region.",
        default: "us-east-1",
        type: "select",
        options: ec2Regions,
      },
    ]
    this.supportedActionTypes = ["cell", "query"]
    this.supportedFormats = ["json_detail"]
    this.requiredFields = [{tag: this.tag}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve , reject ) => {

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("Couldn't get data from attachment.")
        return
      }

      const qr = request.attachment.dataJSON
      if (!qr.fields || !qr.data) {
        reject("Request payload is an invalid format.")
        return
      }

      const ec2 = this.amazonEC2ClientFromRequest(request)

      let instanceIds: string[] = []
      switch (request.type) {
        case "query":
          const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
          const identifiableFields = fields.filter((f: any) =>
            f.tags && f.tags.some((t: string) => t === this.tag),
          )
          if (identifiableFields.length === 0) {
            reject(`Query requires a field tagged ${this.tag}.`)
            return
          }
          instanceIds = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
          break
        case "cell":
          instanceIds = [request.params.value]
          break
      }
      const params = {InstanceIds: instanceIds}
      ec2.stopInstances(params, (err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(new D.DataActionResponse())
        }
      })
    })

  }

  private amazonEC2ClientFromRequest(request: D.DataActionRequest) {
    return new EC2(({
      region: request.params.region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    }))
  }

}

D.addIntegration(new AmazonEC2Integration())
