/* tslint:disable no-console */
import * as Hub from "../../hub"
import MarketoTransaction from "./marketo_transaction"

export class MarketoAction extends Hub.Action {
  // private static chunkify(toChunk: any[], chunkSize: number) {
  //   const arrays = []
  //   while (toChunk.length > 0) {
  //     arrays.push(toChunk.splice(0, chunkSize))
  //   }
  //   return arrays
  // }

  name = "marketo"
  label = "Marketo"
  iconName = "marketo/marketo.svg"
  description = "Update leads and add to Marketo campaign."
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
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  usesStreaming = true

  async execute(request: Hub.ActionRequest) {
    // create a stateful object to manage the transaction
    const transaction = new MarketoTransaction()

    // return the response from the transaction object
    return transaction.handleRequest(request)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Campaign ID",
      name: "campaignID",
      required: true,
      default: "20916", // DNR
      type: "string",
    }, {
      label: "Lead Lookup Field",
      name: "lookupField",
      type: "string",
      description: "Marketo field to use for lookup.",
      default: "email",
      required: true,
    }]
    return form
  }

}

Hub.addAction(new MarketoAction())
