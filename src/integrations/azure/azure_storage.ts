import * as D from "../../framework"

import * as azure from "azure-storage"

export class AzureStorageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "azure_storage"
    this.label = "Azure Storage"
    this.iconName = "azure/azure_storage.png"
    this.description = "Write data files to an Azure container."
    this.supportedActionTypes = [D.ActionType.Query, D.ActionType.Dashboard]
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

  async action(request: D.ActionRequest) {
    return new Promise<D.ActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment")
        return
      }

      if (!request.formParams || !request.formParams.container) {
        reject("Need Azure container.")
        return
      }

      const blobService = this.azureClientFromRequest(request)
      const fileName = request.formParams.filename || request.suggestedFilename()

      if (!fileName) {
        reject("Cannot determine a filename.")
        return
      }

      blobService.createBlockBlobFromText(
        request.formParams.container!,
        fileName,
        request.attachment.dataBuffer,
        (e) => {
          let response
          if (e) {
            response = {success: false, message: e.message}
          }
          resolve(new D.ActionResponse(response))
        })
    })
  }

  async form(request: D.ActionRequest) {
    const promise = new Promise<D.ActionForm>((resolve, reject) => {
      // error in type definition for listContainersSegmented currentToken?
      // https://github.com/Azure/azure-storage-node/issues/352
      const blogService: any = this.azureClientFromRequest(request)
      blogService.listContainersSegmented(null, (err: any, res: any) => {
        if (err) {
          reject(err)
        } else {
          const form = new D.ActionForm()
          form.fields = [{
            label: "Container",
            name: "container",
            required: true,
            options: res.entries.map((c: any) => {
                return {name: c.id, label: c.name}
              }),
            type: "select",
            default: res.entries[0].id,
          }, {
            label: "Filename",
            name: "filename",
            type: "string",
          }]

          resolve(form)
        }
      })
    })
    return promise
  }

  private azureClientFromRequest(request: D.ActionRequest) {
    return azure.createBlobService(request.params.account!, request.params.accessKey!)
  }

}

D.addIntegration(new AzureStorageIntegration())
