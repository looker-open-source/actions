import * as Hub from "../../hub"

export class StubAction extends Hub.Action {
  name = "stubaction"
  label = "Stub"
  iconName = "stubaction/traffic.png"
  description = "Returns a form. Execute does nothing"
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  usesStreaming = false
  minimumSupportedLookerVersion = "6.8.0"
  requiredFields = []
  params = []

  async execute(_request: Hub.ActionRequest) {
    return new Hub.ActionResponse()
  }

  async form(_request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    form.fields = [{
      description: "A select form",
      label: "Select",
      name: "selection",
      options: [{name: "Bob", label: "Bob"}, {name: "Jill", label: "Jill"}],
      required: true,
      type: "select",
      default: "Jill",
    }, {
      label: "Text field",
      name: "text",
      type: "string",
      required: true,
    }, {
      label: "Oauth Link (goes to google)",
      name: "oauthlinktype",
      type: "oauth_link",
      oauth_url: "https://google.com",
    }]
    return form
  }
}

Hub.addAction(new StubAction())
