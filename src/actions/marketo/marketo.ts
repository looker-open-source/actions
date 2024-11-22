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
  executeInOwnProcess = true
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
      description: "Marketo field to use when looking up leads to update",
      default: "email",
      required: true,
    }, {
      label: "Additional Action",
      name: "subaction",
      type: "select",
      options: [
        {
          name: "addCampaign",
          label: "Update lead and add to below Campaign ID",
        }, {
          name: "addList",
          label: "Update lead and add to below List ID",
        }, {
          name: "removeList",
          label: "Update lead and remove from below List ID",
        },
        {
          name: "none",
          label: "None - Update lead only",
        },
      ],
      description: "Additional action to take",
      default: "addCampaign",
      required: true,
    }, {
      label: "Campaign/List ID for Additional Action",
      name: "campaignId",
      // Named campaignId for backwards compatibility with older action, even though it may be
      // either a campaignId or a listId
      type: "string",
      description: "Either a Campaign ID or a List ID, depending on above selection",
      required: false,
    }]
    return form
  }

}

Hub.addAction(new MarketoAction())
