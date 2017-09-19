import * as D from "../framework"

const req = require("request")

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

      const urlHook = request.params.url.toString()

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json")
      }

      if (!request.attachment) {
        throw "Couldn't get data from attachment"
      }

      const qr = JSON.stringify(request.attachment.dataJSON.data)

      if ( !request.params.url) {
        reject("Missing Correct Parameters")
      }

      req({
        url: urlHook,
        method: "POST",   // <--Very important!!!use
        body: qr,
      }, (error: any) => {
        if (!error) {
          resolve(new D.DataActionResponse())
        }
        reject(error)
      })

    })
  }
}

D.addIntegration(new ZapierDropIntegration())
