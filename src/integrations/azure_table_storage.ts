import * as winston from "winston"
import * as D from "../framework"

const azure = require("azure-storage")
// import * as azure from 'aws-sdk/clients/ec2'

export class AzureStorageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "azure_storage"
    this.label = "Azure Storage"
    this.iconName = "azure_storage.svg"
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
    // this.supportedFormats = ["json_detail"]
    // this.supportedFormattings = ["unformatted"]
    // this.supportedVisualizationFormattings = ["noapply"]
  }

  async action(request: D.DataActionRequest) {
    winston.info("top")
    return new Promise<D.DataActionResponse>((resolve, reject) => {
      // winston.info(JSON.stringify(request))

      // if (!request.attachment || !request.attachment.dataBuffer) {
      //   throw "Couldn't get data from attachment"
      // }
      //
      // if (!request.formParams ||
      //   !request.formParams.bucket) {
      //   throw "Need Azure bucket."
      // }
      winston.info("top2")
      if( ! request.params.account){
        reject("Params not working")
      }

      if( ! request.params.accessKey){
        reject("Params not working (missing key)")
      }

      const tableService = azure.createTableService(request.params.account, request.params.accessKey)
      winston.info(tableService)
      tableService.createTableIfNotExists("integrationstest3", (error: any) => {
        if (!error){
          winston.info("Success")
          resolve()
        }
        winston.info("Error")
        reject("error")
      })
      // const blobService = this.azureClientFromRequest(request)
      //
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
