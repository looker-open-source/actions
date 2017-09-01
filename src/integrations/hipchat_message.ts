import * as winston from "winston"
import * as D from "../framework"

const HipChatClient = require('hipchat-client')
// import * as azure from 'aws-sdk/clients/ec2'

/********************************************************************
*********************************************************************/

export class HipchatMessageDrop extends D.Integration {

  allowedTags = ["aws_resource_id", "aws_region"]
  constructor() {
    super()
    this.name = "hipchat_message"
    this.label = "Hipchat Message Drop"
    this.iconName = "hipchat.png"
    this.description = "Send a data attachment as a message to a hipchat room"
    this.supportedActionTypes = ["query", "cell"]
    this.requiredFields = []
    this.params = [

      {
        name: "api_key",
        label: "Auth API Key",
        required: true,
        sensitive: true,
        description: "https://www.hipchat.com/sign_in?d=%2Fadmin%2Fapi",
      },
      {
        name: "room",
        label: "HipChat Room to Post To",
        required: true,
        sensitive: true,
        description: "Name of the HipChat room you would like to post to",
      },
    ]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      const qr = JSON.stringify(request.attachment)
      const hipchat = new HipChatClient(request.params.api_key)

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json")
      }

      if (!request.attachment) {
        throw "Couldn't get data from attachment"
      }

      if (!request.params.account || !request.params.accessKey){
        reject("Missing Correct Parameters")
      }

      if (!request.params.account || !request.params.accessKey){
        reject("Missing Correct Parameters")
      }

      hipchat.api.rooms.message({
        room_id: request.params.room,
        from: 'Integrations',
        message: qr
      }, function (err: any, res: any) {
        if (err) {
          reject(err)
        }
        resolve(res)
        winston.info("Success")
      })
    })
  }
}

D.addIntegration(new HipchatMessageDrop())
