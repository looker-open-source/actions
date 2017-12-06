import * as D from "../../framework"

const trelloApi = require("node-trello")

export interface IList {
  name: string,
  label: string,
}

export class TrelloIntegration extends D.Integration {

  constructor() {
    super()
    this.name = "trello_create_card"
    this.label = "Trello"
    this.iconName = "trello/trello.svg"
    this.description = "Create Trello card referencing a Look."
    this.params = [
      {
        description: "Trello Developer API Key https://trello.com/app-key.",
        label: "API Key",
        name: "api_key",
        required: true,
        sensitive: false,
      }, {
        description: "Trello token https://trello.com/app-key.",
        label: "Token",
        name: "token",
        required: true,
        sensitive: true,
      },
    ]
    this.supportedActionTypes = ["query"]
    this.requiredFields = []
  }

  async action(request: D.ActionRequest) {
    return new Promise<D.ActionResponse>((resolve, reject) => {

      if (!request.attachment || !request.attachment.dataBuffer) {
        reject("Couldn't get data from attachment")
        return
      }

      if (!request.formParams) {
        reject("Need Trello card fields.")
        return
      }

      const trello = this.trelloClientFromRequest(request)

      trello.post("/1/cards", {
          idList: request.formParams.list,
          name: request.formParams.name,
          desc: request.formParams.description,
          urlSource: request.scheduledPlan!.url,
          pos: "top",
        }, (err: any) => {
          let response
          if (err) {
            response = {success: false, message: err.message}
          }
          resolve(new D.ActionResponse(response))
        })
    })
  }

  async form(request: D.ActionRequest) {

    const form = new D.ActionForm()
    const lists = await this.usableLists(request)

    form.fields = [{
      description: "Name of the Trello list to create a card.",
      label: "List",
      name: "list",
      options: lists,
      default: lists[0].name,
      type: "select",
      required: true,
    }, {
      description: "Trello card name.",
      label: "Name",
      name: "name",
      type: "string",
      required: true,
    }, {
      description: "Trello card description.",
      label: "Description",
      name: "description",
      type: "textarea",
      required: true,
    }]
    return form
  }

  async usableLists(request: D.ActionRequest) {
    return new Promise<IList[]>((resolve, reject) => {
      const trello = this.trelloClientFromRequest(request)
      trello.get("/1/members/me/boards", {lists: "all"}, (err: any, response: any) => {
        if (err || response.length === 0) {reject(err)}
        let lists: any[] = []
        response.forEach((b: any) => {
          lists = lists.concat(b.lists.map((l: any) => {
            return {name: l.id, label: b.name + ": " + l.name}
          }))
        })
        resolve(lists)
      })
    })
  }

  private trelloClientFromRequest(request: D.ActionRequest) {
    return new trelloApi(request.params.api_key, request.params.token)
  }

}

D.addIntegration(new TrelloIntegration())
