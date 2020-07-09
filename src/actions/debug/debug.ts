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
      options: [{label: "Jill", name: "jill"}, {label: "Jack", name: "jack"}],
      type: "select",
      interactive: true,
    }]

    if (request.formParams.test_select === "jill") {
      form.fields.push({
        label: "Jill Selected!",
        name: "jill",
        type: "string",
        default: "something changed!",
      })
    } else if (request.formParams.test_select === "jack") {
      form.fields.push({
        label: "Jack Selected!",
        name: "jack",
        type: "oauth_link",
        oauth_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      })
    }
    return form
  }

}

Hub.addAction(new DebugAction())
