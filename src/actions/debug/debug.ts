import * as req from "request-promise-native"

import * as Hub from "../../hub"

export class DebugAction extends Hub.Action {

  name = "debug"
  label = "Debug"
  description = "Sends data to a sample website and optionally sleeps."
  supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Dashboard, Hub.ActionType.Query]
  params = []

  async execute(request: Hub.ActionRequest) {
    const url = process.env.ACTION_HUB_DEBUG_ENDPOINT!
    const sleep = +(request.formParams.sleep || 1000)
    await req.get({url}).promise()
    await this.delay(sleep)
    return new Hub.ActionResponse({message: `Sent a request to ${url} and slept ${sleep} ms.`})
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Sleep",
      name: "sleep",
      required: false,
      type: "string",
    }]
    return form
  }

  private async delay(t: number) {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, t)
    })
  }

}
