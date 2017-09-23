import * as D from "../framework"

// TODO is this the right hipchat client?
const hipchatClient = require("hipchat-client")

export interface IRoom {
  id: string,
  label: string,
}

const MAX_LINES = 10
const HIPCHAT_MAX_MESSAGE_BODY = 10000

export class HipchatIntegration extends D.Integration {

  constructor() {
    super()
    this.name = "hipchat"
    this.label = "Hipchat"
    this.iconName = "hipchat.png"
    this.description = "Send a data attachment as a message to a hipchat room"
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
    this.params = [
      {
        name: "hipchat_api_key",
        label: "API Key",
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

      if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment."
      }

      if (!request.formParams || !request.formParams.room) {
        throw "Missing room."
      }

      const hipchat = this.hipchatClientFromRequest(request)
      const message = request.suggestedTruncatedMessage(MAX_LINES, HIPCHAT_MAX_MESSAGE_BODY)

      hipchat.rooms.message({
        room_id: request.formParams.room,
        from: "Looker",
        message,
      }, (err: any) => {
        if (err) {
          reject(err)
        }
        resolve(new D.DataActionResponse())
      })
    })
  }

  async form(request: D.DataActionRequest) {
    const form = new D.DataActionForm()
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

  usableRooms(request: D.DataActionRequest) {
    return new Promise<IRoom[]>((resolve, reject) => {
      const hipchat = this.hipchatClientFromRequest(request)
      hipchat.rooms.list({}, (err: any, response: any) => {
        if (err) {
          reject(err)
        } else {
          const rooms = response.rooms.filter((r: any) => !r.is_private && !r.is_archived)
          const reformatted: IRoom[] = rooms.map((room: any) => ({id: room.room_id, label: `#${room.name}`}))
          resolve(reformatted)
        }
      })
    })
  }

  private hipchatClientFromRequest(request: D.DataActionRequest) {
    return new hipchatClient(request.params.hipchat_api_key).api
  }

}

D.addIntegration(new HipchatIntegration())
