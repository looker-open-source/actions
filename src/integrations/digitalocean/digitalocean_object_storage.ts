import * as D from "../../framework"
import * as S3Integration from "../amazon/amazon_s3"

import * as S3 from "aws-sdk/clients/s3"

export class DigitalOceanObjectStorageIntegration extends S3Integration.AmazonS3Integration {

  constructor() {
    super()

    this.name = "digitalocean_object_storage"
    this.label = "DigitalOcean Spaces"
    this.iconName = "digitalocean/DigitalOcean.png"
    this.description = "Write data files to DigitalOcean's Spaces storage."
    this.params = [
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
  }

  async form(request: D.ActionRequest) {
    const form = await super.form(request)
    form.fields.filter( (field) => field.name === "bucket")[0].label = "Space Name"
    return form
  }

  protected amazonS3ClientFromRequest(request: D.ActionRequest) {
   return new S3({
     region: request.params.region,
     endpoint: `https://${request.params.region}.digitaloceanspaces.com`,
     accessKeyId: request.params.access_key_id,
     secretAccessKey: request.params.secret_access_key,
   })
 }

}

D.addIntegration(new DigitalOceanObjectStorageIntegration())
