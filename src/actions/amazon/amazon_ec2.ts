import * as Hub from "../../hub"

import * as EC2 from "aws-sdk/clients/ec2"

const TAG = "aws_resource_id"

export class AmazonEC2Action extends Hub.Action {

  name = "aws_ec2_stop_instance"
  label = "AWS EC2 - Stop Instance"
  iconName = "amazon/amazon_ec2.png"
  description = "Stop an EC2 instance."
  params = [
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
  supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  requiredFields = [{ tag: TAG }]

  async execute(request: Hub.ActionRequest) {
    let instanceIds: string[] = []
    switch (request.type) {
      case Hub.ActionType.Query:
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
      case Hub.ActionType.Cell:
        if (!request.params.value) {
          throw "Couldn't get data from cell."
        }
        instanceIds = [request.params.value]
        break
    }
    const params = {InstanceIds: instanceIds}

    const ec2 = this.amazonEC2ClientFromRequest(request)
    let response
    try {
      await ec2.stopInstances(params).promise()
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new Hub.ActionResponse(response)
  }

  private amazonEC2ClientFromRequest(request: Hub.ActionRequest) {
    return new EC2(({
      region: request.params.region,
      accessKeyId: request.params.access_key_id,
      secretAccessKey: request.params.secret_access_key,
    }))
  }

}

Hub.addAction(new AmazonEC2Action())
