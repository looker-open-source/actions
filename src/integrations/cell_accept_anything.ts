// import * as uuid from "uuid"

import * as D from "../framework"
import * as winston from 'winston'

// import * as EC2 from 'aws-sdk/clients/ec2'
// import * as Promise from 'bluebird'


export class CellAcceptAnythingIntegration extends D.Integration {

  allowedTags = ["aws_resource_id", "aws_region"]

  constructor() {
    super()

    this.name = "cell_accept_anything_event"
    this.label = "Cell Accept Anything"
    this.iconName = "AWS_EC2.png"
    this.description = "This Integration appears on Cells and Accepts Anything."
    this.params = [
    //   {
    //     description: "",
    //     label: "AWS Access Key",
    //     name: "aws_access_key",
    //     required: true,
    //     sensitive: false,
    //   },
    //   {
    //       description: "",
    //       label: "AWS Secret Key",
    //       name: "aws_secret_key",
    //       required: true,
    //       sensitive: true,
    //   },
    ]
    this.supportedActionTypes = ["cell"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
    this.requiredFields = [{all_tags: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve /*, reject */) => {

      winston.info("whole request: ")
      winston.info(JSON.stringify(request))
      /*
      example request:

      {
        "formParams": {},
        "params": {
          "value": "i-069a3f0d83b161926"
        },
        "type": "cell",
        "instanceId": "33affe795e918360fb44f4c1dd0adf6c",
        "webhookId": "2a958224efa273086a8cf3b338caa0c8"
      }

      */

      resolve(new D.DataActionResponse())
    })

  }

}

D.addIntegration(new CellAcceptAnythingIntegration())
