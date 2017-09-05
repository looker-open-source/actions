import * as winston from "winston"
import * as D from "../framework"

const req = require("request")
// import * as azure from 'aws-sdk/clients/ec2'

/********************************************************************
 *  The majority of this integration is built into the Zapier app    *
 *  whatever "Zaps" you build this integration will send the data    *
 *  attachment to Zapier. Must first generate a Zapier Webhhook url  *
 *  (endpoint for your data post) --> Simply create a new zap -      *
 *  built the first trigger as a webhhook --> willgive you a url     *
 *  endpoint                                                         *
*********************************************************************/

export class ZapierDropIntegration extends D.Integration {

  constructor() {
    super()
    this.name = "zapier_drop"
    this.label = "Zapier Integrations Work Flow"
    this.iconName = "zapier.png"
    this.description = "Takes a data attachment and begins a Zapier workflow"
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "user",
        label: "User email account",
        required: true,
        description: "Your email login for Zapier",
        sensitive: false,
      },
      {
        name: "password",
        label: "password",
        required: true,
        sensitive: true,
        description: "Your Zapier account password",
      },
      {
        name: "url",
        label: "Zapier URL EndPoint",
        required: true,
        sensitive: true,
        description: "The WebHook URL endpoint for your Zaps",
      },
    ]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {
      // containerName must be the name of an existing blob container in Azure storage
      // const containerName = "integrationscontainer"

      const url_hook = request.params.url.toString()

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json")
      }

      if (!request.attachment) {
        throw "Couldn't get data from attachment"
      }

      const qr = JSON.stringify(request.attachment.dataJSON.data)

      if (!request.params.user || !request.params.password || !request.params.url){
        reject("Missing Correct Parameters")
      }

      req({
        url: url_hook,
        method: "POST",   // <--Very important!!!use
        body: qr,
      }, function(error: any, response: any){
        if (!error){
          winston.info("Success")
          resolve(response)
        }
        reject(error)
      })

    })
  }
}

D.addIntegration(new ZapierDropIntegration())
