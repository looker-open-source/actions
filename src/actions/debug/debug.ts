import * as winston from "winston"

import * as Hub from "../../hub"

export function registerDebugAction() {
  if (process.env.ACTION_HUB_DEBUG_ENDPOINT) {
    Hub.addAction(new DebugAction())
  }
}

export class DebugAction extends Hub.Action {

  name = "debug"
  label = "Debug"
  description = "Sends data to a sample website and optionally sleeps."
  supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
  params = []
  executeInOwnProcess = true

  async execute(request: Hub.ActionRequest) {
    winston.info(JSON.stringify(request.formParams))
    return new Hub.ActionResponse({message: `Completed debug action successfully by doing.`})
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Select Me Interactive",
      name: "test_select",
      options: [
        {label: "Jill", name: "jill"},
        {label: "Jack", name: "jack"},
        {label: "Jack & Jill", name: "jack_jill"},
      ],
      type: "select",
      interactive: true,
      required: true,
    }]
    const testSelect = request.formParams.test_select

    if (testSelect === "jill") {
      form.fields.push({
        label: "Jill Selected!",
        name: "jill",
        type: "string",
        default: "something changed!",
        required: true,
      })
    } else if (testSelect === "jack") {
      form.fields.push({
        label: "Jack Selected!",
        name: "jack",
        type: "oauth_link",
        oauth_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      })
    } else if (testSelect === "jack_jill") {
      form.fields.push({
        label: "Went up the hill",
        name: "jack_jill_action",
        options: [{label: "to fetch a pail of water", name: "water"}, {label: "for no reason", name: "none"}],
        type: "select",
        interactive: false,
      })

      // const jackJillAction = request.formParams.jack_jill_action
      // if (jackJillAction === "water") {
      //   form.fields.push({
      //     label: "Comment",
      //     name: "comment",
      //     type: "string",
      //     description: "Jack & Jill went up the hill to fetch a pail of water!",
      //   })
      // } else if (jackJillAction === "none") {
      //   form.fields.push({
      //     label: "Comment",
      //     name: "comment",
      //     type: "string",
      //     description: "Jack & Jill went up the hill for no reason!",
      //   })
      // }
    }
    return form
  }

}

Hub.addAction(new DebugAction())
