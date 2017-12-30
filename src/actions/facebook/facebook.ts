import * as Hub from "../../hub"

const FB = require("fb")

export interface Destination {
  id: string,
  label: string,
}

export class FacebookAction extends Hub.Action {

  constructor() {
    super()
    this.name = "facebook"
    this.label = "Facebook Workplace"
    this.iconName = "facebook/facebook.svg"
    this.description = "Write a message to Facebook Workplace."
    this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
    this.params = [
      {
        name: "facebook_app_access_token",
        label: "Facebook App Access Token",
        required: true,
        description:
          "https://developers.facebook.com/docs/workplace/integrations/custom-integrations/reference#appaccesstoken",
        sensitive: true,
      },
    ]
  }

  async execute(request: Hub.ActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams || !request.formParams.destination) {
      throw "Missing destination."
    }

    const fb = this.facebookClientFromRequest(request)
    const message = request.formParams.message || request.scheduledPlan!.title!
    const link = request.scheduledPlan && request.scheduledPlan.url
    const qs = {
      message,
      link,
    }

    // POST /id/feed
    const resp = await fb.api(`/${request.formParams.destination}/feed`, "post", qs)
    let response
    if (!resp || resp.error) {
      response = {success: false, message: resp ? resp.error : "Error Occurred"}
    }

    return new Hub.ActionResponse(response)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    const destinations = await this.usableDestinations(request)
    form.fields = [{
      description: "Name of the Facebook group you would like to post to.",
      label: "Share In",
      name: "destination",
      options: destinations.map((destination) => ({name: destination.id, label: destination.label})),
      required: true,
      type: "select",
    }, {
      label: "Message",
      type: "string",
      name: "message",
    }]

    return form
  }

  async usableDestinations(request: Hub.ActionRequest): Promise<Destination[]> {
    const fb = this.facebookClientFromRequest(request)
    const response = fb.api("/community")
    // confirm response structure
    let destinations = await this.usableGroups(fb, response.community.id)
    destinations = destinations.concat(await this.usableMembers(fb, response.community.id))
    return destinations
  }

  async usableGroups(fb: any, community: string) {
    const response = fb.api(`/${community}/groups`)
    // confirm response structure
    // https://developers.facebook.com/tools/explorer/145634995501895/?method=GET&path=community&version=v2.11
    return response.groups.map((group: any) => ({id: group.id, label: `#${group.name}`}))
  }

  async usableMembers(fb: any, community: string) {
    const response = fb.api(`/${community}/members`)
    // confirm response structure
    return response.members.map((members: any) => ({id: members.id, label: `@${members.name}`}))
  }

  private facebookClientFromRequest(request: Hub.ActionRequest) {
    const options = {
      accessToken: request.params.facebook_app_access_token,
    }
    return new FB.Facebook(options)
  }

}

Hub.addAction(new FacebookAction())
