import * as D from "../framework"

const HipChatClient = require("hipchat-client")

/********************************************************************
 * Hipchat has a message limit length of 10,000 --> for this reason
 * looker query type data action is too large and wont work unless
 * there is some way to shorten the amount of data that gets passed
*********************************************************************/

export class HipchatMessageDrop extends D.Integration {

  constructor() {
    super()
    this.name = "hipchat_message"
    this.label = "Hipchat Message Drop"
    this.iconName = "hipchat.png"
    this.description = "Send a data attachment as a message to a hipchat room"
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "api_key",
        label: "Auth API Key",
        required: true,
        sensitive: true,
        description: "https://www.hipchat.com/sign_in?d=%2Fadmin%2Fapi",
      },
    ]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
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
        const cr = String(request.params.value)

        if (!request.params.api_key || !request.params.room){
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
          })
      }

        const cell_level_drop = function(){
          hipchat.api.rooms.message({
              room_id: request.params.room,
              from: "Integrations",
              message: cr,
          }, function(err: any, res: any) {
              if (err) {
                  reject(err)
              }
              resolve(res)
          })
      }

        if (request.params.value) {
            cell_level_drop()
        } else {
            query_level_drop()
        }

    })
  }

  async form(){
    const form = new D.DataActionForm()

    form.fields = [
      {
        name: "room",
        label: "HipChat Room to Post To",
        required: true,
        sensitive: false,
        description: "Name of the HipChat room you would like to post to",
        type: "string",
      },
    ]

    return form
  }
}

D.addIntegration(new HipchatMessageDrop())
