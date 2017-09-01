import * as winston from "winston"
import * as D from "../framework"

const HipChatClient = require("hipchat-client")
// import * as azure from 'aws-sdk/clients/ec2'

/********************************************************************
 * Hipchat has a message limit length of 10,000 --> for this reason
 * looker query type drop are way too large and wont work unless there
 * is some way to shorten the amount of data that gets passed
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

        const hipchat = new HipChatClient(request.params.api_key)

        if (!(request.attachment && request.params)) {
        reject("No attached json")
      }

        if (!request.attachment) {
        throw "Couldn't get data from attachment"
      }

        const tester = request.attachment.dataJSON.data
        const qr = JSON.stringify(tester)
        console.log("Data", qr)

      // console.log("This is the data right here:", JSON.stringify(request.attachment.dataJSON, null, 2))
      // const tester = request.attachment.dataJSON.data
      // const tester2 = tester[0]["instances.name"].links[0].params.value
      // console.log("TESTER DATA: ", tester)
      // console.log("TESTER22222 DATA: ", tester2)

        if (!request.params.account || !request.params.accessKey){
        reject("Missing Correct Parameters")
      }

        if (!request.params.account || !request.params.accessKey){
        reject("Missing Correct Parameters")
      }

        const query_level_drop = function(){
          hipchat.api.rooms.message({
              room_id: request.params.room,
              from: "Integrations",
              message: qr,
          }, function(err: any, res: any) {
              if (err) {
                  reject(err)
              }
              resolve(res)
              winston.info("Success")
          })
      }

        const cell_level_drop = function(){
          hipchat.api.rooms.message({
              room_id: request.params.room,
              from: "Integrations",
              message: request.params.value,
          }, function(err: any, res: any) {
              if (err) {
                  reject(err)
              }
              resolve(res)
              winston.info("Success")
          })
      }

        if (!request.params.value){
          query_level_drop()
      }else{
          cell_level_drop()
      }

    })
  }
}

D.addIntegration(new HipchatMessageDrop())
