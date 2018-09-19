import * as Hub from "../../hub"

const hipchat = require("hipchatter")

interface Room {
  id: string,
  label: string,
}

const MAX_LINES = 10
const HIPCHAT_MAX_MESSAGE_BODY = 10000

export class HipchatAction extends Hub.Action {

  name = "hipchat"
  label = "Hipchat"
  iconName = "hipchat/hipchat.png"
  description = "Send a message to a Hipchat room referencing data."
  supportedActionTypes = [Hub.ActionType.Query]
  requiredFields = []
  params = [
    {
      name: "hipchat_api_key",
      label: "HipChat API Key",
      required: true,
      sensitive: true,
      description: "API Key generated at https://hipchat.com/account/api",
    },
  ]
  supportedFormats = [Hub.ActionFormat.Csv]

  async execute(request: Hub.ActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams.room) {
      throw "Missing room."
    }

    const message = request.suggestedTruncatedMessage(MAX_LINES, HIPCHAT_MAX_MESSAGE_BODY)

    let response
    try {
      const hipchatClient = this.hipchatClientFromRequest(request)

      await new Promise<void>((resolve, reject) => {
        hipchatClient.send_room_message(
          request.formParams.room, {
            from: "Looker",
            message,
          }, (err: any) => {
            if (err) {
              reject(err)
            } else {
              resolve()
            }
          })
        })
    } catch (e) {
      response = { success: false, message: e.message }
    }
    return new Hub.ActionResponse(response)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    try {
      const rooms = await this.usableRooms(request)
      form.fields = [{
        description: "Name of the Hipchat room you would like to post to.",
        label: "Share In",
        name: "room",
        options: rooms.map((room) => ({name: room.id, label: room.label})),
        required: true,
        type: "select",
      }]
    } catch (e) {
      form.error = this.prettyError(e)
    }

    return form
  }

  private prettyError(e: any) {
    if (e.message === "Invalid OAuth session") {
      return "Your Hipchat authentication credentials are not valid."
    } else {
      return e
    }
  }

  private async usableRooms(request: Hub.ActionRequest) {
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
