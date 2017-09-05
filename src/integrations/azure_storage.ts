import * as winston from "winston"
import * as D from "../framework"

const azure = require("azure-storage")

/****************************************************************************
 * This Integration Assumes you have an Azure account. Given an account
 * and an access key the integration then creates a storage container called
 * integrationscontainer (if one doesn't already exist) and then writes
 * the looker attachment as a blobfile titled qrBlob to the container.
 *****************************************************************************/

export class AzureStorageIntegration extends D.Integration {

  allowedTags = ["aws_resource_id", "aws_region"]
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
      // containerName must be the name of an existing blob container in Azure storage
      // const containerName = "integrationscontainer"
      winston.info(JSON.stringify(request.attachment))

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

      const containerName = "integrationscontainer"
      const blobService = azure.createBlobService(request.params.account, request.params.accessKey)
      // winston.info(blobService)
      blobService.createContainerIfNotExists(containerName, { publicAccessLevel: "blob"}, (error: any) => {
        if (!error){
          blob_write()
        }
        winston.info("Error", error)
      })

      const blob_write = function(){
        blobService.createBlockBlobFromText(
            containerName,
            "qrBlob",
            qr,
            function(error: any){
              if (error){
                winston.info("Couldn't upload blob")
                reject(error)
              } else {
                winston.info("Uploaded Successfully")
                resolve()
              }
            })
      }
    })
  }
}

D.addIntegration(new AzureStorageIntegration())
