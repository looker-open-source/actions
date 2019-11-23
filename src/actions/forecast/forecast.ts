import * as winston from "winston"
import * as Hub from "../../hub"

export class ForecastAction extends Hub.Action {
  // required fields
  // TODO: make email-related fields required
  name = "amazon_forecast"
  label = "Amazon Forecast"
  supportedActionTypes = [Hub.ActionType.Query]
  params = [
    {
      name: "accessKeyId",
      label: "Access Key",
      required: true,
      sensitive: true,
      description: "Your AWS access key ID.",
    },
    {
      name: "secretAccessKey",
      label: "Secret Key",
      required: true,
      sensitive: true,
      description: "Your AWS secret access key.",
    },
    {
      name: "roleArn",
      label: "Role ARN",
      required: true,
      sensitive: false,
      description: "ARN of role allowing Forecast to read from your S3 bucket(s)",
    },
    {
      name: "region",
      label: "Region",
      required: true,
      sensitive: false,
      description: "AWS Region where you run Forecast",
    },
    {
      name: "user_email",
      label: "Looker User Email",
      required: false,
      description: `
        Click the button on the right and select 'Email'.
        This is required for the action to send status emails
        when action is complete.
      `,
      sensitive: false,
    },
    {
      name: "smtpHost",
      label: "SMTP Host",
      required: false,
      sensitive: false,
      description: "Host for sending emails.",
    },
    {
      name: "smtpPort",
      label: "SMTP Port",
      required: false,
      sensitive: false,
      description: "Port for sending emails.",
    },
    {
      name: "smtpFrom",
      label: "SMTP From",
      required: false,
      sensitive: false,
      description: "From for sending emails.",
    },
    {
      name: "smtpUser",
      label: "SMTP User",
      required: false,
      sensitive: false,
      description: "User for sending emails.",
    },
    {
      name: "smtpPass",
      label: "SMTP Pass",
      required: false,
      sensitive: false,
      description: "Pass for sending emails.",
    },
  ]

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
    winston.debug(JSON.stringify(request.params, null, 2))
    return new Hub.ActionResponse({ success: true })
  }

  async form(request: Hub.ActionRequest) {
    winston.debug(JSON.stringify(request.params, null, 2))
    const form = new Hub.ActionForm()
    // TODO: for early development, these are string fields for now. Use more sane inputs after execute is implemented
    // TODO: add description props to these fields
    // TODO: populate options
    // TODO: should include "include country for holidays" field?
    form.fields = [
      {
        label: "Dataset group name",
        name: "datasetGroupName",
        required: true,
        type: "string",
      },
      {
        label: "Forecasting domain",
        name: "forecastingDomain",
        required: true,
        type: "string",
      },
      {
        label: "Dataset name",
        name: "datasetName",
        required: true,
        type: "string",
      },
      {
        label: "Frequency Period",
        name: "frequencyPeriod",
        required: true,
        type: "string",
      },
      {
        label: "Frequency Interval",
        name: "frequencyInterval",
        required: true,
        type: "string",
      },
      {
        label: "Data Schema",
        name: "dataSchema",
        required: true,
        type: "string",
      },
      {
        label: "Timestamp Format",
        name: "timestampFormat",
        required: true,
        type: "string",
      },
      {
        label: "Predictor Name",
        name: "predictorName",
        required: true,
        type: "string",
      },
      {
        label: "Forecast Horizon",
        name: "forecastHorizon",
        required: true,
        type: "string",
      },
      {
        label: "Forecast Name",
        name: "forecastName",
        required: true,
        type: "string",
      },
      {
        label: "Forecast Destination Bucket",
        name: "forecastDestinationBucket",
        required: true,
        type: "string",
      },
    ]
    return form
  }
}

Hub.addAction(new ForecastAction())
