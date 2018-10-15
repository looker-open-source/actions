import * as Hub from "../../hub"

import * as azure from "azure-storage"

export class AzureStorageAction extends Hub.Action {

  name = "azure_storage"
  label = "Azure Storage"
  iconName = "azure/azure_storage.png"
  description = "Write data files to an Azure container."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [
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

  async execute(request: Hub.ActionRequest) {
    return new Promise<Hub.ActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment")
        return
      }

      if (!request.formParams.container) {
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
        request.formParams.container,
        fileName,
        request.attachment.dataBuffer,
        (e?: Error) => {
          if (e) {
            resolve(new Hub.ActionResponse({ success: false, message: e.message }))
          } else {
            resolve(new Hub.ActionResponse({ success: true }))
          }
        })
    })
  }

  async form(request: Hub.ActionRequest) {
    const promise = new Promise<Hub.ActionForm>((resolve, reject) => {
      // error in type definition for listContainersSegmented currentToken?
      // https://github.com/Azure/azure-storage-node/issues/352
      const blogService: any = this.azureClientFromRequest(request)
      blogService.listContainersSegmented(null, (err: any, res: any) => {
        if (err) {
          reject(err)
        } else {
          const form = new Hub.ActionForm()
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

  private azureClientFromRequest(request: Hub.ActionRequest) {
    return azure.createBlobService(request.params.account!, request.params.accessKey!)
  }

}

Hub.addAction(new AzureStorageAction())
