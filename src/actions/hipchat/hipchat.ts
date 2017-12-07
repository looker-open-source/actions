import * as Hub from "../../framework"

const hipchat = require("hipchatter")

interface Room {
  id: string,
  label: string,
}

const MAX_LINES = 10
const HIPCHAT_MAX_MESSAGE_BODY = 10000

export class HipchatAction extends Hub.Action {

  constructor() {
    super()
    this.name = "hipchat"
    this.label = "Hipchat"
    this.iconName = "hipchat/hipchat.png"
    this.description = "Send a message to a Hipchat room referencing data."
    this.supportedActionTypes = [Hub.ActionType.Query]
    this.requiredFields = []
    this.params = [
      {
        name: "hipchat_api_key",
        label: "HipChat API Key",
        required: true,
        sensitive: true,
        description: "API Key generated at https://hipchat.com/account/api",
      },
    ]
    this.supportedFormats = [Hub.ActionFormat.JsonDetail]
    this.supportedFormattings = [Hub.ActionFormatting.Unformatted]
  }

  async execute(request: Hub.ActionRequest) {
    return new Promise<Hub.ActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment.")
        return
      }

      if (!request.formParams || !request.formParams.room) {
        reject("Missing room.")
        return
      }

      const hipchatClient = this.hipchatClientFromRequest(request)
      const message = request.suggestedTruncatedMessage(MAX_LINES, HIPCHAT_MAX_MESSAGE_BODY)

      let response
      hipchatClient.send_room_message(
        request.formParams.room, {
          from: "Looker",
          message,
        }, (err: any) => {
          if (err) {
            response = {success: false, message: err.message}
          }
        })
      resolve(new Hub.ActionResponse(response))
    })
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const rooms = await this.usableRooms(request)

    form.fields = [{
      description: "Name of the Hipchat room you would like to post to.",
      label: "Share In",
      name: "room",
      options: rooms.map((room) => ({name: room.id, label: room.label})),
      required: true,
      type: "select",
    }]

    return form
  }

  async usableRooms(request: Hub.ActionRequest) {
    return new Promise<Room[]>((resolve, reject) => {
      const hipchatClient = this.hipchatClientFromRequest(request)
      hipchatClient.rooms((err: any, response: any) => {
        if (err) {
          reject(err)
        } else {
          const rooms = response.filter((r: any) => !(r.privacy === "private") && !r.is_archived)
          const reformatted: Room[] = rooms.map((room: any) => ({id: room.id, label: room.name}))
          resolve(reformatted)
        }
      })
    })
  }

  private hipchatClientFromRequest(request: Hub.ActionRequest) {
    return new hipchat(request.params.hipchat_api_key)
  }

}

Hub.addAction(new HipchatAction())
