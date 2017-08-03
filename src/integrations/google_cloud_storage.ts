import * as D from "../framework"

const storage = require("@google-cloud/storage")

export class GoogleCloudStorageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "google_cloud_storage"
    this.label = "Google Cloud Storage"
    this.iconName = "google_cloud_storage.png"
    this.description = "Write data files to an GCS bucket."
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "clientEmail",
        label: "Client Email",
        required: true,
        description: "Your client email for GCS.",
      }, {
        name: "privateKey",
        label: "Private Key",
        required: true,
        sensitive: true,
        description: "Your private key for GCS.",
      }, {
        name: "projectId",
        label: "Project Id",
        required: true,
        description: "The Project Id for your GCS project.",
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

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      // TODO find GCP API to pull available buckets.
      label: "Bucket",
      name: "bucket",
      required: true,
      type: "string",
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]

    return form
  }

  private gcsClientFromRequest(request: D.DataActionRequest) {
    const config = {
      projectId: request.formParams.projectId,
      credentials: {
        client_email: request.formParams.clientEmail,
        private_key: request.formParams.privateKey,
      },
    }
    return new storage(config)
  }

}

D.addIntegration(new GoogleCloudStorageIntegration())
