// import * as FormData from "form-data"
// import * as req from "request"
import * as Hub from "../../hub"

const FB = require("fb")
const fileType = require("file-type")

export interface Destination {
  id: string,
  label: string,
}

function log(...args: any[]) {
  console.log.apply(console, args)
}

export class WorkplaceAction extends Hub.Action {

  name = "workplace-facebook"
  label = "Workplace by Facebook"
  iconName = "workplace/workplace-facebook.svg"
  description = "Write a message to Workplace by Facebook."
  // added Hub.ActionType.Query because dashboards are sending request.type: query
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  supportedFormats = [Hub.ActionFormat.WysiwygPng]
  params = [
    {
      name: "facebook_app_access_token",
      label: "Facebook App Access Token",
      required: true,
      description:
        "https://developers.facebook.com/docs/workplace/integrations/custom-integrations/reference#appaccesstoken",
      sensitive: true,
    },
  ]

  async execute(request: Hub.ActionRequest) {
    this.debugRequest(request)

    let response

    const photoResponse = await this.postToFacebook(request)

    if (!photoResponse || photoResponse.error) {
      response = { success: false, message: photoResponse ? photoResponse.error : "Error in Photo Upload Occurred" }
    }

    return new Hub.ActionResponse(response)

  }

  getMarkdownMessage(request: Hub.ActionRequest): string {
    if (!request.scheduledPlan) {
      throw "Missing scheduledPlan."
    }

    const { title, url } = request.scheduledPlan
    if (!title || !url) {
      throw "Missing title or url."
    }

    const { message } = request.formParams

    const parts = [
      `[${title}](${url})`,
      message,
    ]

    return parts.join("\n\n")
  }

  async postToFacebook(request: Hub.ActionRequest) {
    // return new Promise<any>((resolve, reject) => {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }
    const buffer = request.attachment.dataBuffer
    const bufferType = fileType(buffer)
    log("bufferType", bufferType)

    if (!request.formParams || !request.formParams.destination) {
      throw "Missing destination."
    }
    const groupId = encodeURIComponent(request.formParams.destination)
    log("groupId", groupId)

    const message = this.getMarkdownMessage(request)
    log("message", message)

    const photoOptions = {
      source: {
        value: buffer,
        options: {
          filename: `source.${bufferType.ext}`,
          contentType: bufferType.mime,
        },
      },
      message,
      formatting: "MARKDOWN",
    }

    const fb = this.facebookClientFromRequest(request)

    const response = await fb.api(`/${groupId}/photos`, "post", photoOptions)

    return response

    // old req.post version below here
    // req.post({ url: graphUrl, formData: photoOptions }, (err, response, body) => {
    //   if (err) {
    //     return reject(err)
    //   }
    //   log("body", body)
    //   resolve(response)
    // })
    // })
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    const destinations = await this.usableDestinations(request)
    form.fields = [
      {
        description: "Name of the Facebook group you would like to post to.",
        label: "Share In",
        name: "destination",
        options: destinations.map((destination) => ({ name: destination.id, label: destination.label })),
        required: true,
        type: "select",
      },
      {
        description: "Optional message to accompany the post.",
        label: "Message",
        type: "textarea",
        name: "message",
      },
    ]

    return form
  }

  private async usableDestinations(request: Hub.ActionRequest): Promise<Destination[]> {
    const fb = this.facebookClientFromRequest(request)
    const response = await fb.api("/community")
    if (!(response && response.id)) {
      throw "No community."
    }
    const groups = await this.usableGroups(fb, response.id)
    return groups
  }

  private async usableGroups(fb: any, community: string) {
    const response = await fb.api(`/${encodeURIComponent(community)}/groups`)
    const groups = response.data.filter((g: any) => g.privacy ? g.privacy !== "CLOSED" : true)
    return groups.map((g: any) => ({ id: g.id, label: `#${g.name}` }))
  }

  private facebookClientFromRequest(request: Hub.ActionRequest) {
    const options = {
      accessToken: request.params.facebook_app_access_token,
    }
    return new FB.Facebook(options)
  }

  private debugRequest(request: Hub.ActionRequest) {
    const requestInfo = Object.assign({}, request)
    requestInfo.attachment = Object.assign({}, request.attachment)
    delete requestInfo.attachment.dataBuffer
    // delete requestInfo.attachment.dataJSON
    log("-".repeat(40))
    log(JSON.stringify(requestInfo, null, 2))
    log("-".repeat(40))
  }

}

Hub.addAction(new WorkplaceAction())
