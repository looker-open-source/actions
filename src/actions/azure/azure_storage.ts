import { BlobServiceClient, StorageSharedKeyCredential } from "@azure/storage-blob"
import * as Hub from "../../hub"

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
    const containerClient = blobService.getContainerClient(container)
    const blockBlobClient = containerClient.getBlockBlobClient(fileName)

    try {
      await request.stream(async (readable) => {
        return blockBlobClient.uploadStream(readable)
      })
      return new Hub.ActionResponse({ success: true })
    } catch (e: any) {
      return new Hub.ActionResponse({success: false, message: e.message})
    }
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const blobService: BlobServiceClient = this.azureClientFromRequest(request)
    return new Promise<Hub.ActionForm>(async (resolve, _reject) => {
      for await (const response of blobService.listContainers().byPage()) {
        if (response.containerItems.length > 0) {
          const entries: any[] = response.containerItems
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
          }
        } else {
          form.error = "Create a container in your Azure account."
          resolve(form)
        }
      }
    })
  }

  private azureClientFromRequest(request: Hub.ActionRequest): BlobServiceClient {
    const account = request.params.account
    // The account name is interpolated into the Blob storage host, so it is
    // restricted to the Azure storage account charset to prevent host injection.
    if (!account || !/^[a-z0-9]{3,24}$/.test(account)) {
      throw "Invalid Azure storage account name."
    }
    try {
      const sharedKeyCredential = new StorageSharedKeyCredential(account, request.params.accessKey!)
      return new BlobServiceClient(
        `https://${account}.blob.core.windows.net`,
        sharedKeyCredential,
      )
    } catch (err: any) {
      if (err && err.toString().includes("base64")) {
        throw "The provided Account Key is not a valid base64 string"
      }
      throw "Error making Azure client. Storage Account and Access Key settings may be incorrect"
    }
  }

}

Hub.addAction(new AzureStorageAction())
