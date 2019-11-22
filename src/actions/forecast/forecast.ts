import * as Hub from "../../hub"

export class ForecastAction extends Hub.Action {
  // required fields
  name = "amazon_forecast"
  label = "Amazon Forecast"
  supportedActionTypes = [Hub.ActionType.Query]
  params = []

  // optional fields
  description = "Import data into Amazon Forecast, train a model, and generate a forecast from that model"
  usesStreaming = true
  requiredFields = []
  // TODO: for which of these optional fields should I provide values?
  // iconName = ""
  // supportedFormats = [Hub.ActionFormat.Csv]
  // supportedFormattings = [Hub.ActionFormatting.Unformatted]
  // supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  async execute(request: Hub.ActionRequest) {
    // TODO
    return new Hub.ActionResponse({ success: true })
  }

  async form(request: Hub.ActionRequest) {
    // TODO
    return new Hub.ActionForm()
  }
}

Hub.addAction(new ForecastAction())
