import * as Hub from "../../hub"

const storage = require("@google-cloud/storage")

export class GoogleCloudStorageAction extends Hub.Action {

  name = "google_cloud_storage"
  label = "Google Cloud Storage"
  iconName = "google/google_cloud_storage.svg"
  description = "Write data files to a Google Cloud Storage bucket."
  supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
  usesStreaming = true
  requiredFields = []
  params = [
    {
      name: "client_email",
      label: "Client Email",
      required: true,
      sensitive: false,
      description: "Your client email for GCS from https://console.cloud.google.com/apis/credentials",
    }, {
      name: "private_key",
      label: "Private Key",
      required: true,
      sensitive: true,
      description: "Your private key for GCS from https://console.cloud.google.com/apis/credentials",
    }, {
      name: "project_id",
      label: "Project Id",
      required: true,
      sensitive: false,
      description: "The Project Id for your GCS project from https://console.cloud.google.com/apis/credentials",
    },
  ]

  async execute(request: Hub.ActionRequest) {

    if (!request.formParams || !request.formParams.bucket) {
      throw "Need Google Cloud Storage bucket."
    }

    const gcs = this.gcsClientFromRequest(request)
    const file = gcs.bucket(request.formParams.bucket)
      .file(request.formParams.filename || request.suggestedFilename())

    try {
      await request.stream(async (readable) => {
        return file.save(readable)
      })
      return new Hub.ActionResponse({ success: true })
    } catch (e) {
      return new Hub.ActionResponse({success: false, message: e.message})
    }

  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    const gcs = this.gcsClientFromRequest(request)
    const buckets = await gcs.getBuckets()[0]

    if (!buckets) {
      throw "No buckets in account."
    }

    form.fields = [{
      label: "Bucket",
      name: "bucket",
      required: true,
      options: buckets.map((b: any) => {
          return {name: b.id, label: b.name}
        }),
      type: "select",
      default: buckets[0].id,
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]

    return form
  }

  private gcsClientFromRequest(request: Hub.ActionRequest) {
    const credentials = {
      client_email: request.params.client_email,
      private_key: request.params.private_key!.replace(/\\n/g, "\n"),
    }
    const config = {
      projectId: request.params.project_id,
      credentials,
    }

    return new storage(config)
  }

}

Hub.addAction(new GoogleCloudStorageAction())
