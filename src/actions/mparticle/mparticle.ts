import * as semver from "semver"
import * as Hub from "../../hub"

import { MparticleTransaction } from "./mparticle_transaction"

export class MparticleAction extends Hub.Action {

  name = "mparticle"
  label = "mParticle"
  iconName = "mparticle/mparticle.svg"
  description = "Send user or event data from Looker to mParticle."
  params = [
    {
      description: "API Key for mParticle",
      label: "API Key",
      name: "apiKey",
      required: true,
      sensitive: false,
    },
    {
      description: "API Secret for mParticle",
      label: "API Secret",
      name: "apiSecret",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  usesStreaming = true
  executeInOwnProcess = true
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream]
    } else {
      return [Hub.ActionFormat.JsonDetail]
    }
  }

  async execute(request: Hub.ActionRequest) {
    // create a stateful object to manage the transaction
    const transaction = new MparticleTransaction()
    // return the response from the transaction object
    return transaction.handleRequest(request)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [
      {
        label: "Data Type",
        name: "data_type",
        description: "Specify data type: User Profiles or Events",
        required: true,
        options: [
          {name: "user_data", label: "User Profiles"},
          {name: "event_data", label: "Events"},
        ],
        type: "select",
      },
      {
        label: "Environment",
        name: "environment",
        description: "Specify environment to send to: Test/Development or Production",
        required: true,
        options: [
          {name: "production", label: "Production"},
          {name: "development", label: "Test/Development"},
        ],
        type: "select",
      },
    ]
    return form
  }
}

Hub.addAction(new MparticleAction())
