import * as winston from "winston"
import * as D from "../framework"

const azure = require("azure-storage")
// import * as azure from 'aws-sdk/clients/ec2'

export class AzureStorageIntegration extends D.Integration {

  allowedTags = ["aws_resource_id", "aws_region"]
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
      const containerName = "integrationscontainer"
      winston.info(JSON.stringify(request.attachment))

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json")
      }

      if (!request.attachment) {
        throw "Couldn't get data from attachment"
      }

      // winston.info("THIS IS IT 1111: ", JSON.stringify(request.attachment))
      const qr = JSON.stringify(request.attachment)

      if (!request.params.account || !request.params.accessKey){
        reject("Missing Correct Parameters")
      }

      if (!request.params.account || !request.params.accessKey){
        reject("Missing Correct Parameters")
      }

      // const containerName = "integrationscontainer"
      const blobService = azure.createBlobService(request.params.account, request.params.accessKey)
      // winston.info(blobService)
      // blobService.createContainerIfNotExists(containerName, { publicAccessLevel: "blob"}, (error: any, result: any, response: any) => {
      //   if (!error){
      //     winston.info("Success")
      //     winston.info(response)
      //     resolve(result)
      //   }
      //   reject("error")
      // })

      blobService.createBlockBlobFromText(
          containerName,
          "qrContainer",
          qr,
          function(error: any){
            if (error){
              winston.info("Couldn't upload string")
              winston.info(error)
              reject()
            } else {
              winston.info("Uploaded Successfully")
              resolve()
            }
          })
      // const blobService = this.azureClientFromRequest(request)

      // blobService.createBlockBlobFromStream(request.formParams.container,
      //   request.formParams.filename ? request.formParams.filename : request.suggestedFilename(),
      //   )
      // file.save(request.attachment.dataBuffer)
      //   .then(() => resolve(new D.DataActionResponse()))
      //   .catch((err: any) => { reject(err) })

    })
  }

  // async form(request: D.DataActionRequest) {
  //   const form = new D.DataActionForm()
  //   const blogService = this.azureClientFromRequest(request)
  //   const containers = await blogService.listContainersSegmented(null)
  //
  //   form.fields = [{
  //     label: "Container",
  //     name: "container",
  //     required: true,
  //     options: containers.map((c: any) => {
  //         return {name: c.id, label: c.name}
  //       }),
  //     type: "select",
  //     default: containers[0].id,
  //   }, {
  //     label: "Filename",
  //     name: "filename",
  //     type: "string",
  //   }]
  //
  //   return form
  // }
  //
  // private azureClientFromRequest(request: D.DataActionRequest) {
  //   return new azure.createBlobService(request.params.account, request.params.accessKey)
  //       .withFilter(new azure.ExponentialRetryPolicyFilter());
  // }

}

D.addIntegration(new AzureStorageIntegration())
