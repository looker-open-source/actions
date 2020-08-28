import * as Hub from "../../hub"
import { PagerDutyClient } from './pagerduty_client'

export class PagerDutyAction extends Hub.Action {

  name = "pagerduty"
  label = "PagerDuty"
  iconName = "pagerduty/pd_icon.png"
  description = "PagerDuty"
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  requiredFields = []
  params = [{
    name: "pagerduty_api_key",
    label: "PagerDuty API Key",
    required: true,
    description: `A PagerDuty API key used to authenticate with the PagerDuty REST API. For how to generate a key, please follow instructions at https://support.pagerduty.com/docs/generating-api-keys`,
    sensitive: true,
  }]
  usesStreaming = false

  async execute(request: Hub.ActionRequest) {
    console.log(`Execute ${request.streamJson.toString}`)
    return Promise.reject(new Error("foo"))
  }

  async form(request: Hub.ActionRequest) {
    const apiKey = request.params['pagerduty_api_key']

    if (apiKey == null) {
      return Promise.reject("Internal error, required field not found: 'pagerduty_api_key'")
    }

    const client = new PagerDutyClient(apiKey)
    const services = await client.services()

    const form = new Hub.ActionForm()
    form.fields = [
      {
        description: "PagerDuty service to open incident on",
        label: "PagerDuty service",
        name: "pd_service",
        options: services.map(s => ({ name: s.id, label: s.name })),
        required: true,
        type: "select",
      }
    ]

    return form
  }


}

Hub.addAction(new PagerDutyAction())
