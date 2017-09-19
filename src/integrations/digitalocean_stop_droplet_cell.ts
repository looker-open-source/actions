// import * as uuid from "uuid"

import * as winston from "winston"
import * as D from "../framework"

import { OutgoingHttpHeaders } from "http"
import * as https from "https"
import { RequestOptions } from "https"
// import * as http from 'http'
// import { RequestOptions } from '@types/node'

// import * as Promise from 'bluebird'

export class DigitalOceanStopDropletCellEvent extends D.Integration {

  allowedTags = ["digitalocean_droplet_id"]

  constructor() {
    super()

    this.name = "digitalocean_stop_droplet_cell_event"
    this.label = "DigitalOcean Stop a Droplet from Cell"
    this.iconName = "DigitalOcean.png"
    this.description = ""
    this.params = [
      {
        description: "",
        label: "DigitalOcean Personal Access Token",
        name: "digitalocean_personal_access_token",
        required: true,
        sensitive: true,
      },

    ]
    this.supportedActionTypes = ["cell"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve , reject ) => {

      winston.info("whole request: ")
      winston.info(JSON.stringify(request))
      /*
      example request:

      {
        "type": "cell",
        "scheduled_plan": null,
        "form_params": {},
        "data": {
          "value": "11111111",
          "digitalocean_personal_access_token": ""
        },
        "attachment": null
      }

      After DataActionRequest.fromRequest():

      {
        "formParams": {},
        "params": {
          "value": "11111111",
          "digitalocean_personal_access_token": ""
        },
        "type": "cell",
        "instanceId": "33affe795e918360fb44f4c1dd0adf6c",
        "webhookId": "2a958224efa273086a8cf3b338caa0c8"
      }

      */
      if ( ! request.params ) {
          reject("incorrect DataActionRequest: no 'params' property")
      }

      if ( ! request.params.value || request.params.value.length < 1) {
          reject("incorrect DataActionRequest: property 'params.value' is empty")
      }

      const options: RequestOptions = {}
      options.protocol = "https:"
      options.host = "api.digitalocean.com"
      options.path = `/v2/droplets/${request.params.value}/actions`
      options.method = "POST"
      const headers: OutgoingHttpHeaders = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${request.params.digitalocean_personal_access_token}`,
      }
      options.headers = headers

      const req = https.request(options, (response) => {
          let str = ""

          response.on("data", (chunk) => {
            str += chunk
          })

          // the whole response has been recieved, so we just print it out here
          response.on("end", () => {
            winston.info(str)

            resolve(new D.DataActionResponse())
          })
      })

      req.on("error", (e) => {
          reject(e)
      })

      req.write(JSON.stringify({ type: "power_off" }))
      req.end()

    })

  }

}

D.addIntegration(new DigitalOceanStopDropletCellEvent())
