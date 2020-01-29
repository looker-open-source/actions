import * as Hub from "../../hub"

import * as azure from "azure-storage"

export class AzureStorageAction extends Hub.Action {

  name = "azure_storage"
  label = "Azure Storage"
  iconName = "azure/azure_storage.png"
  description = "Write data files to an Azure container."
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  usesStreaming = true
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

    if (!request.formParams.container) {
      throw "Need Azure container."
    }

    const fileName = request.formParams.filename || request.suggestedFilename()
    const container = request.formParams.container

    if (!fileName) {
      return new Hub.ActionResponse({ success: false, message: "Cannot determine a filename." })
    }

    const blobService = this.azureClientFromRequest(request)
    const writeStream = blobService.createWriteStreamToBlockBlob(container, fileName)

    try {
      await request.stream(async (readable) => {
        return new Promise<any>((resolve, reject) => {
          readable.pipe(writeStream)
            .on("error", reject)
            .on("finish", resolve)
        })
      })
      return new Hub.ActionResponse({ success: true })
    } catch (e) {
      return new Hub.ActionResponse({success: false, message: e.message})
    }
  }

  async form(request: Hub.ActionRequest) {
    // error in type definition for listContainersSegmented currentToken?
    // https://github.com/Azure/azure-storage-node/issues/352
    const form = new Hub.ActionForm()
    const blobService: any = this.azureClientFromRequest(request)
    return new Promise<Hub.ActionForm>((resolve, _reject) => {
      blobService.listContainersSegmented(null, (err: any, res: any) => {
        if (err) {
          form.error = err
          resolve(form)
        } else {
          const entries: any[] = res.entries
          if (entries.length > 0) {
            form.fields = [{
              label: "Container",
              name: "container",
              required: true,
              options: entries.map((c: any) => {
                return {name: c.name, label: c.name}
              }),
              type: "select",
              default: entries[0].name,
            }, {
              label: "Filename",
              name: "filename",
              type: "string",
            }]
            resolve(form)
          } else {
            form.error = "Create a container in your Azure account."
            resolve(form)
          }
        }
      })
    })
  }

  private azureClientFromRequest(request: Hub.ActionRequest) {
    try {
      return azure.createBlobService(request.params.account!, request.params.accessKey!)
    } catch (err) {
      if (err && err.toString().includes("base64")) {
        throw "The provided Account Key is not a valid base64 string"
      }
      throw "Error making Azure client. Storage Account and Access Key settings may be incorrect"
    }
  }

}

Hub.addAction(new AzureStorageAction())
