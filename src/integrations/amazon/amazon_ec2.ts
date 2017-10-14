import * as D from "../../framework"

const EC2 = require("aws-sdk/clients/ec2")

const TAG = "aws_resource_id"

export class AmazonEC2Integration extends D.Integration {

  constructor() {
    super()

    this.name = "aws_ec2_stop_instance"
    this.label = "AWS EC2 Stop Instance"
    this.iconName = "amazon_ec2.png"
    this.description = "Stop an EC2 instance"
    this.params = [
      {
        name: "access_key_id",
        label: "Access Key",
        required: true,
        sensitive: true,
        description: "Your access key for EC2.",
      }, {
        name: "secret_access_key",
        label: "Secret Key",
        required: true,
        sensitive: true,
        description: "Your secret key for EC2.",
      }, {
        name: "region",
        label: "Region",
        required: true,
        sensitive: false,
        description: "EC2 Region e.g. us-east-1, us-west-1, ap-south-1 from " +
          "http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_region.",
      },
    ]
    this.supportedActionTypes = ["cell", "query"]
    this.supportedFormats = ["json_detail"]
    this.requiredFields = [{tag: TAG}]
  }

  async action(request: D.DataActionRequest) {
    let instanceIds: string[] = []
    switch (request.type) {
      case "query":
        if (!(request.attachment && request.attachment.dataJSON)) {
          throw "Couldn't get data from attachment."
        }

        const qr = request.attachment.dataJSON
        if (!qr.fields || !qr.data) {
          throw "Request payload is an invalid format."
        }
        const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
        const identifiableFields = fields.filter((f: any) =>
          f.tags && f.tags.some((t: string) => t === TAG),
        )
        if (identifiableFields.length === 0) {
          throw `Query requires a field tagged ${TAG}.`
        }
        instanceIds = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
        break
      case "cell":
        if (!request.params.value) {
          throw "Couldn't get data from cell."
        }
        instanceIds = [request.params.value]
        break
    }
    const params = {InstanceIds: instanceIds}

    const ec2 = this.amazonEC2ClientFromRequest(request)
    try {
      await ec2.stopInstances(params)
      return new D.DataActionResponse({success: true})
    } catch (e) {
      return new D.DataActionResponse({success: false, message: e.message})
    }

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
