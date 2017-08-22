import * as D from "../framework"

const azure = require('azure-storage')

export class AzureStorageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "azure_storage"
    this.label = "Azure Storage"
    this.iconName = "azure_storage.svg"
    this.description = "Write data files to an Azure container."
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "account",
        label: "Storage Account",
        required: true,
        description: "Your account for Azure.",
      }, {
        name: "accessKey",
        label: "Access Key",
        required: true,
        sensitive: true,
        description: "Your access key for Azure.",
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
        throw "Need Azure bucket."
      }

      const blobService = this.azureClientFromRequest(request)

      blobService.createBlockBlobFromStream(request.formParams.container,
        request.formParams.filename ? request.formParams.filename : request.suggestedFilename(),
        )
      file.save(request.attachment.dataBuffer)
        .then(() => resolve(new D.DataActionResponse()))
        .catch((err: any) => { reject(err) })
    })
  }

  async form(request: D.DataActionRequest) {
    const form = new D.DataActionForm()
    const blogService = this.azureClientFromRequest(request)
    const containers = await blogService.listContainersSegmented(null)

    form.fields = [{
      label: "Container",
      name: "container",
      required: true,
      options: containers.map((c: any) => {
          return {name: c.id, label: c.name}
        }),
      type: "select",
      default: containers[0].id,
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]

    return form
  }

  private azureClientFromRequest(request: D.DataActionRequest) {
    return new azure.createBlobService(request.params.account, request.params.accessKey)
        .withFilter(new azure.ExponentialRetryPolicyFilter());
  }

}

D.addIntegration(new AzureStorageIntegration())
