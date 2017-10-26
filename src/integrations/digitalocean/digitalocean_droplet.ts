import * as D from "../../framework"

import digitalOcean = require("do-wrapper")

const TAG = "digitalocean_droplet_id"

export class DigitalOceanDropletIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "digitalocean_droplet"
    this.label = "DigitalOcean Droplet"
    this.iconName = "digitalocean/DigitalOcean.png"
    this.description = "Stop an DigitalOcean droplet."
    this.params = [
      {
        name: "digitalocean_api_key",
        label: "DigitalOcean API Key",
        required: true,
        sensitive: true,
        description: "",
      },
    ]
    this.supportedActionTypes = ["cell", "query"]
    this.supportedFormats = ["json_detail"]
    this.requiredFields = [{tag: TAG}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve , reject) => {

      let instanceIds: string[] = []
      switch (request.type) {
        case "query":
          if (!(request.attachment && request.attachment.dataJSON)) {
            reject("Couldn't get data from attachment.")
            return
          }

          const qr = request.attachment.dataJSON
          if (!qr.fields || !qr.data) {
            reject("Request payload is an invalid format.")
            return
          }
          const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
          const identifiableFields = fields.filter((f: any) =>
            f.tags && f.tags.some((t: string) => t === TAG),
          )
          if (identifiableFields.length === 0) {
            reject(`Query requires a field tagged ${TAG}.`)
            return
          }
          instanceIds = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
          break
        case "cell":
          const value = request.params.value
          if (!value) {
            reject("Couldn't get data from attachment.")
            return
          }
          instanceIds = [value]
          break
      }

      const digitalOceanClient = this.digitalOceanClientFromRequest(request)
      instanceIds.forEach((dropletId) => {
        digitalOceanClient.dropletsRequestAction(+dropletId, {type: "power_off"}, (err: any) => {
          if (err) {
            resolve(new D.DataActionResponse({success: false, message: err.message}))
          } else {
            resolve(new D.DataActionResponse())
          }
        })
      })

    })

  }

  private digitalOceanClientFromRequest(request: D.DataActionRequest) {
    return new digitalOcean(request.params.digitalocean_api_key!)
  }

}

D.addIntegration(new DigitalOceanDropletIntegration())
