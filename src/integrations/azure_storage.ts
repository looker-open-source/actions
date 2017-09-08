import * as D from "../framework"

const azure = require("azure-storage")

/****************************************************************************
 * This Integration Assumes you have an Azure account. Given an account
 * and an access key the integration then creates a storage container called
 * integrationscontainer (if one doesn't already exist) and then writes
 * the looker attachment as a blobfile titled qrBlob to the container.
 *****************************************************************************/

export class AzureStorageIntegration extends D.Integration {

  allowedTags = ["azure_key_id"]
  constructor() {
    super()
    this.name = "azure_storage"
    this.label = "Azure Storage"
    this.iconName = "azure.png"
    this.description = "Write data files to an Azure container."
    this.supportedActionTypes = ["query", "cell"]
    this.requiredFields = []
    this.params = [
      {
        name: "account",
        label: "Storage Account",
        required: true,
        description: "Your account for Azure.",
        sensitive: false,
      },
      {
        name: "accessKey",
        label: "Access Key",
        required: true,
        sensitive: true,
        description: "Your access key for Azure.",
      },
    ]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json")
      }

      if (!request.attachment) {
        throw "Couldn't get data from attachment"
      }

      const qr = JSON.stringify(request.attachment.dataJSON.data)

      if (!request.params.account || !request.params.accessKey){
        reject("Missing Correct Parameters")
      }
      // let blob_name: string
      const containerName = "integrationscontainer"
      const blobService = azure.createBlobService(request.params.account, request.params.accessKey)
      blobService.createContainerIfNotExists(containerName, { publicAccessLevel: "blob"}, (error: any) => {
        if (!error){
            blob_write()
        }
      })

      // let blob_check = function(){
      //      blobService.listBlobsSegmented(containerName, null, function(error: any, results: any, _callback: any) {
      //          if (error) {
      //              console.log(error)
      //              winston.info("Error on listBlobsSegmented")
      //          } else {
      //              for (let i = 0, blob; blob = results.entries[i]; i++) {
      //                  blob_name = blob
      //              }
      //          }
      //      })
      //      return blob_name
      //  }

      const blob_write = function(){
        blobService.createBlockBlobFromText(
            containerName,
            "qrBlob",
            qr,
            function(error: any){
              if (error){
                reject(error)
              } else {
                resolve()
              }
            })
      }
    })
  }
}

D.addIntegration(new AzureStorageIntegration())
