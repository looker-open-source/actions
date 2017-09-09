import * as winston from "winston"
import * as D from "../framework"

import * as azure from 'azure-storage'
/*
 * module augmentation is required here because the 'currentToken' parameter incorrectly forbids nulls
 */
declare module 'azure-storage' {
  class BlobService {
    listContainersSegmented(currentToken: common.ContinuationToken|undefined, options: BlobService.ListContainerOptions, callback: ErrorOrResult<BlobService.ListContainerResult>): void;
    createContainerIfNotExists(container: string, options: BlobService.CreateContainerOptions, callback: ErrorOrResult<BlobService.ContainerResult>): void;
    createBlockBlobFromText(container: string, blob: string, text: string | Buffer, callback: ErrorOrResult<BlobService.BlobResult>): void;
  }
}

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

  async action(request: D.DataActionRequest): Promise<D.DataActionResponse> {
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

      if (!request.params.account || !request.params.accessKey || !request.formParams.containerName ){
        reject("Missing Correct Parameters")
      }
      // let blob_name: string

      const blobService = azure.createBlobService(request.params.account, request.params.accessKey)
      // winston.info(blobService)
      blobService.createContainerIfNotExists(request.formParams.containerName, { publicAccessLevel: "blob"}, (error: any) => {
        if (!error){
            // const x = blob_check
            // console.log("BlobName BlobName BlobName BlobName 22222222: ", x)
            // blob_check()
            blob_write()
        }
        winston.info("Error", error)
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
            request.formParams.containerName,
            request.formParams.blobName,
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

  async form(request: D.DataActionRequest): Promise<D.DataActionForm> {

    const blobService:azure.BlobService = azure.createBlobService(request.params.account, request.params.accessKey)
    const containers:Array<{ name: string, label: string }> = [];
    let first = 1;
    let token:azure.common.ContinuationToken|undefined = undefined;
    while( first || token ) {
      first = 0;
      try {
        const containerResponse = await new Promise<azure.BlobService.ListContainerResult>(function(resolve,reject){
          blobService.listContainersSegmented(token, {}, function(err, result) {
            if(err){
              reject(err);
            } else {
              resolve(result)
            }
          })
        })
        containerResponse.entries.forEach((el:azure.BlobService.ContainerResult) => containers.push({
            name: el.name,
            label: el.name
        }))
        token = containerResponse.continuationToken;
      } catch(err){
        containers.push({
          name: "error",
          label: `<Failed to list "${request.params.account}">`
        })
        token = undefined;
      }

    }

    const form = new D.DataActionForm()
    form.fields = [
      {
        label: "Container Name",
        name: "containerName",
        required: true,
        type: "select",
        options: containers
      },
      {
        label: "Blob Name",
        name: "blobName",
        required: true,
        type: "string"
      },
    ]
    return form
  }

}

D.addIntegration(new AzureStorageIntegration())
