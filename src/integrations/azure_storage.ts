import * as D from "../framework"

const azure = require("azure-storage")

export class AzureStorageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "azure_storage"
    this.label = "Azure Storage"
    this.iconName = "azure_storage.svg"
    this.description = "Write data files to an Azure container."
    this.supportedActionTypes = ["query", "dashboard"]
    this.requiredFields = []
    this.params = [
      {
        name: "account",
        label: "Storage Account",
        required: true,
        sensitive: false,
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

      if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment"
      }

      if (!request.formParams || !request.formParams.container) {
        throw "Need Azure container."
      }

      const blobService = this.azureClientFromRequest(request)
      const fileName = request.formParams.filename ? request.formParams.filename : request.suggestedFilename()

      try {
        const response = await blobService.createBlockBlobFromText(
          request.formParams.container, fileName, request.attachment.dataBuffer)
        return new D.DataActionResponse({success: true, message: response})
      } catch (e) {
        throw e.message
      }

  }

  async form(request: D.DataActionRequest) {
    const blogService = this.azureClientFromRequest(request)
    try {
      const response = await blogService.listContainersSegmented()
      const form = new D.DataActionForm()
      form.fields = [{
        label: "Container",
        name: "container",
        required: true,
        options: response.entries.map((c: any) => {
            return {name: c.id, label: c.name}
          }),
        type: "select",
        default: response.entries[0].id,
      }, {
        label: "Filename",
        name: "filename",
        type: "string",
      }]
      return form
    } catch (e) {
      throw e.message
    }
  }

  private azureClientFromRequest(request: D.DataActionRequest) {
    return new azure.createBlobService(request.params.account, request.params.accessKey)
        .withFilter(new azure.ExponentialRetryPolicyFilter())
  }

}

D.addIntegration(new AzureStorageIntegration())
