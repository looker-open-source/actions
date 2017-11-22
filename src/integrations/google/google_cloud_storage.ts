import * as D from "../../framework"

const storage = require("@google-cloud/storage")

export class GoogleCloudStorageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "google_cloud_storage"
    this.label = "Google Cloud Storage"
    this.iconName = "google/google_cloud_storage.svg"
    this.description = "Write data files to an GCS bucket."
    this.supportedActionTypes = ["query", "dashboard"]
    this.requiredFields = []
    this.params = [
      {
        name: "client_email",
        label: "Client Email",
        required: true,
        sensitive: false,
        description: "Your client email for GCS from https://console.cloud.google.com/",
      }, {
        name: "private_key",
        label: "Private Key",
        required: true,
        sensitive: true,
        description: "Your private key for GCS from https://console.cloud.google.com/",
      }, {
        name: "project_id",
        label: "Project Id",
        required: true,
        sensitive: false,
        description: "The Project Id for your GCS project from https://console.cloud.google.com/",
      },
    ]
  }

  async action(request: D.ActionRequest) {

      if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment"
      }

      if (!request.formParams ||
        !request.formParams.bucket) {
        throw "Need GCS bucket."
      }

      const gcs = this.gcsClientFromRequest(request)
      const file = gcs.bucket(request.formParams.bucket)
        .file(request.formParams.filename ? request.formParams.filename : request.suggestedFilename())

      let response
      try {
        await file.save(request.attachment.dataBuffer)
      } catch (e) {
        response = {success: false, message: e.message}
      }

      return new D.ActionResponse(response)
  }

  async form(request: D.ActionRequest) {
    const form = new D.ActionForm()

    const gcs = this.gcsClientFromRequest(request)
    const buckets = await gcs.getBuckets()[0]

    form.fields = [{
      label: "Bucket",
      name: "bucket",
      required: true,
      options: buckets.map((b: any) => {
          return {name: b.metadata.id, label: b.metadata.name}
        }),
      type: "select",
      default: buckets[0].metadata.id,
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]

    return form
  }

  private gcsClientFromRequest(request: D.ActionRequest) {
    const credentials = {
      client_email: request.params.client_email,
      private_key: request.params.private_key,
    }
    const config = {
      projectId: request.params.project_id,
      credentials,
    }

    return new storage(config)
  }

}

D.addIntegration(new GoogleCloudStorageIntegration())
