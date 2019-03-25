import * as semver from "semver"
import * as Hub from "../../hub"
import { MarketoTransaction } from "./marketo_transaction"

export class MarketoAction extends Hub.Action {
  name = "marketo"
  label = "Marketo"
  iconName = "marketo/marketo.svg"
  description = "Update Marketo leads and their campaign/list membership."
  params = [
    {
      description: "Identity server host URL",
      label: "URL",
      name: "url",
      required: true,
      sensitive: false,
    },
    {
      description: "Client ID from Marketo",
      label: "Client ID",
      name: "clientID",
      required: true,
      sensitive: false,
    },
    {
      description: "Client Secret from Marketo",
      label: "Client Secret",
      name: "clientSecret",
      required: true,
      sensitive: true,
    },

  ]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  usesStreaming = true
  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream]
    } else {
      return [Hub.ActionFormat.JsonDetail]
    }
  }

  async execute(request: Hub.ActionRequest) {
    // create a stateful object to manage the transaction
    const transaction = new MarketoTransaction()
    // return the response from the transaction object
    return transaction.handleRequest(request)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Lead Lookup Field",
      name: "lookupField",
      type: "string",
      description: "Marketo field to use for lookup",
      default: "email",
      required: true,
    }, {
      label: "Add to Campaign IDs (optional)",
      name: "campaignIds",
      type: "string",
      description: "Campaign IDs to add the leads to, if any, comma-separated",
      required: false,
    }, {
      label: "Add to List IDs (optional)",
      name: "addListIds",
      type: "string",
      description: "List IDs to add the leads to, if any, comma-separated",
      required: false,
    }, {
      label: "Remove from List IDs (optional)",
      name: "removeListIds",
      type: "string",
      description: "List IDs to remove the leads from, if any, comma-separated",
      required: false,
    }]
    return form
  }

}

Hub.addAction(new MarketoAction())
