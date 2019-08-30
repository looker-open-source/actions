import * as Hub from "../../hub"

import * as req from "request-promise-native"
//import * as url from "url"

// import {WebhookAction} from "../webhook/webhook"
//
// export class NifiSQLAction extends WebhookAction {

export class NifiSQLAction extends Hub.Action {

  name = "nifi_sql"
  label = "NiFi - SQL Generator"
  iconName = "nifi/nifi.png"
  description = "Send sql query from a look to Nifi as a Flowfile."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  params = []
  //domain = "3.222.225.79"

  async execute(request: Hub.ActionRequest) {

    if (!request.formParams.url) {
      throw "Missing url."
    }

    const providedUrl = request.formParams.url

    try {
      await request.stream(async (readable) => {
        return req.post({ uri: providedUrl, body: readable } ).promise()
      })
      return new Hub.ActionResponse({ success: true })
    } catch (e) {
      return new Hub.ActionResponse({ success: false, message: e.message })
    }
  }


  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      name: "url",
      label: "HTTP endpoint to NiFi instance",
      description: "e.g. http://nifi/host/path:port",
      type: "string",
      required: true,
    }]
    return form
  }


}

Hub.addAction(new NifiSQLAction())
