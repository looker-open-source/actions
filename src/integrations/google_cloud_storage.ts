import * as D from "../framework"

const storage = require("@google-cloud/storage")

export class GoogleCloudStorageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "google_cloud_storage"
    this.label = "Google Cloud Storage"
    this.iconName = "google_cloud_storage.svg"
    this.description = "Write data files to an GCS bucket."
    this.supportedActionTypes = ["query", "dashboard"]
    this.requiredFields = []
    this.params = [
      {
        name: "clientEmail",
        label: "Client Email",
        required: true,
        sensitive: false,
        description: "Your client email for GCS from https://console.cloud.google.com/",
      }, {
        name: "privateKey",
        label: "Private Key",
        required: true,
        sensitive: true,
        description: "Your private key for GCS from https://console.cloud.google.com/",
      }, {
        name: "projectId",
        label: "Project Id",
        required: true,
        sensitive: false,
        description: "The Project Id for your GCS project from https://console.cloud.google.com/",
      },
    ]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

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

      file.save(request.attachment.dataBuffer)
        .then(() => resolve(new D.DataActionResponse()))
        .catch((err: any) => { reject(err) })
    })
  }

  async form(request: D.DataActionRequest) {
    const form = new D.DataActionForm()

    const gcs = this.gcsClientFromRequest(request)
    const buckets = await gcs.getBuckets()

    form.fields = [{
      label: "Bucket",
      name: "bucket",
      required: true,
      options: buckets[0].map((b: any) => {
          return {name: b.metadata.id, label: b.metadata.name}
        }),
      type: "select",
      default: buckets[0][0].metadata.id,
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]

    return form
  }

  private gcsClientFromRequest(request: D.DataActionRequest) {
    // Looker double escapes newlines from the integration param settings
    // const credentials = {client_email: request.params.clientEmail, private_key: request.params.privateKey}
    const credentials = JSON.parse(`{"client_email": "${request.params.clientEmail}",
      "private_key": "${request.params.privateKey}"}`)

    const config = {
      projectId: request.params.projectId,
      credentials,
    }

    return new storage(config)
  }

}

D.addIntegration(new GoogleCloudStorageIntegration())
