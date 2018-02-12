import * as Hub from "../../hub"
import { AmazonS3Action } from "../amazon/amazon_s3"

import * as S3 from "aws-sdk/clients/s3"

export class DigitalOceanObjectStorageAction extends AmazonS3Action {

  name = "digitalocean_object_storage"
  label = "DigitalOcean Spaces"
  iconName = "digitalocean/DigitalOcean.png"
  description = "Write data files to DigitalOcean's Spaces storage."
  params = [
    {
      name: "access_key_id",
      label: "Spaces Access Key",
      required: true,
      sensitive: false,
      description: "Your access key for DigitalOcean Spaces https://cloud.digitalocean.com/settings/api/tokens.",
    }, {
      name: "secret_access_key",
      label: "Spaces Secret Key",
      required: true,
      sensitive: true,
      description: "Your secret key for DigitalOcean Spaces https://cloud.digitalocean.com/settings/api/tokens.",
    }, {
      name: "region",
      label: "Region",
      required: true,
      sensitive: false,
      description: "DigitalOcean Region e.g. NYC3 ",
    },
  ]

  async form(request: Hub.ActionRequest) {
    const form = await super.form(request)
    form.fields.filter( (field) => field.name === "bucket")[0].label = "Space Name"
    return form
  }

  protected amazonS3ClientFromRequest(request: Hub.ActionRequest) {
   return new S3({
     region: request.params.region,
     endpoint: `https://${request.params.region}.digitaloceanspaces.com`,
     accessKeyId: request.params.access_key_id,
     secretAccessKey: request.params.secret_access_key,
   })
 }

}

Hub.addAction(new DigitalOceanObjectStorageAction())
