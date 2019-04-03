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
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment"
    }

    if (!request.formParams.container) {
      throw "Need Azure container."
    }

    const blobService = this.azureClientFromRequest(request)
    const fileName = request.formParams.filename || request.suggestedFilename()
    const container = request.formParams.container
    const data = request.attachment.dataBuffer

    if (!fileName) {
      return new Hub.ActionResponse({ success: false, message: "Cannot determine a filename." })
    }

    return new Promise<Hub.ActionResponse>((resolve, reject) => {
      blobService.createBlockBlobFromText(
        container,
        fileName,
        data,
        (e?: Error) => {
          if (e) {
            reject(new Hub.ActionResponse({success: false, message: e.message}))
          } else {
            resolve(new Hub.ActionResponse({success: true}))
          }
        })
    })
  }

  async form(request: Hub.ActionRequest) {
    // error in type definition for listContainersSegmented currentToken?
    // https://github.com/Azure/azure-storage-node/issues/352
    const form = new Hub.ActionForm()
    const blogService: any = this.azureClientFromRequest(request)
    return new Promise<Hub.ActionForm>((resolve, _reject) => {
      blogService.listContainersSegmented(null, (err: any, res: any) => {
        if (err) {
          form.error = err
          resolve(form)
        } else {
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
  }

  private azureClientFromRequest(request: Hub.ActionRequest) {
    return azure.createBlobService(request.params.account!, request.params.accessKey!)
  }

}

Hub.addAction(new AzureStorageAction())
