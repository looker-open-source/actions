import * as Hub from "../../hub"

import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { dataFrequencyOptions, holidayCalendarOptions } from "./forecast_form_options"
import ForecastPredictor from "./forecast_predictor"
import { ForecastTrainPredictorActionParams } from "./forecast_types"
import { pollForCreateComplete } from "./poller"

// TODO: parseInt/Float on numeric cols from Looker, as they contain commas
export class ForecastTrainPredictorAction extends Hub.Action {
  // required fields
  // TODO: make email-related fields required?
  name = "amazon_forecast_predictor"
  label = "Amazon Forecast Train Predictor"
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
  description = "Train a time series prediction model with Amazon Forecast"
  usesStreaming = true
  requiredFields = []
  supportedFormats = [Hub.ActionFormat.Csv] // TODO: can be empty array, since this action needs no data?
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  // iconName = "" // TODO

  // TODO: include extra params: backtest window, other backtest param
  // TODO: move form field options to external module
  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    // TODO: any error handling needed here?
    const datasetGroups = await this.listDatasetGroups(request)
    const datasetGroupOptions = datasetGroups.map((dg) => ({ name: dg.DatasetGroupArn!, label: dg.DatasetGroupName! }))
    datasetGroupOptions.unshift({ name: "New Group", label: "New Group" })

    form.fields = [
      {
        label: "Dataset group ARN",
        name: "datasetGroupArn",
        required: true,
        type: "select",
        description: "ARN of the dataset group to use when building the predictor",
        options: datasetGroupOptions,
      },
      {
        label: "Forecast Frequency",
        name: "forecastFrequency",
        required: true,
        type: "select",
        options: Object.entries(dataFrequencyOptions).map(([name, label]) => ({ name, label })),
        description: "The frequency of predictions in a forecast",
      },
      { // TODO: should I calculate this value instead of asking for input
        label: "Forecast Horizon",
        name: "forecastHorizon",
        required: true,
        type: "string",
        description: "Specifies the number of time-steps that the model is trained to predict",
      },
      {
        label: "Predictor Name",
        name: "predictorName",
        required: true,
        type: "string",
        description: "This name can help you distinguish this predictor from others",
      },
      {
        label: "Country for holidays",
        name: "countryForHolidays",
        required: false,
        type: "select",
        options: Object.entries(holidayCalendarOptions).map(([name, label]) => ({ name, label })),
        description: "The holiday calendar you want to include for model training",
      },
    ]
    return form
  }

  async execute(request: Hub.ActionRequest) {
    try {
      this.startPredictorTraining(request).catch(winston.error)
      // response acknowledges that predictor training has started, not that it's complete
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      winston.error(JSON.stringify(err, null, 2))
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  private async listDatasetGroups(request: Hub.ActionRequest) {
    const forecastService = this.forecastServiceFromRequest(request)
    const { DatasetGroups } = await forecastService.listDatasetGroups().promise()
    const results = []
    if (DatasetGroups) {
      results.push(...DatasetGroups)
    }
    return results
  }

  private async startPredictorTraining(request: Hub.ActionRequest) {
    const actionParams = this.getRequiredActionParamsFromRequest(request)
    const {
      accessKeyId,
      secretAccessKey,
      region,
    } = actionParams
    // create Forecast dataset resource & feed in S3 data
    const forecastService = new ForecastService({ accessKeyId, secretAccessKey, region })
    const forecastPredictor = new ForecastPredictor({ forecastService, ...actionParams })
    await forecastPredictor.startResourceCreation()
    await pollForCreateComplete(forecastPredictor.getResourceCreationStatus)
    // TODO: send email on success/fail?
  }

  private getRequiredActionParamsFromRequest(request: Hub.ActionRequest): ForecastTrainPredictorActionParams {
    const {
      datasetGroupArn,
      forecastFrequency,
      predictorName,
      forecastHorizon,
    } = request.formParams

    const {
      accessKeyId,
      secretAccessKey,
      region,
    } = request.params
    // TODO: are there AWS naming rules that I need to enforce in the UI?
    if (!forecastFrequency) {
      throw new Error("Missing forecastFrequency")
    }
    if (!accessKeyId) {
      throw new Error("Missing accessKeyId")
    }
    if (!secretAccessKey) {
      throw new Error("Missing secretAccessKey")
    }
    if (!region) {
      throw new Error("Missing region")
    }
    if (!predictorName) {
      throw new Error("Missing predictorName")
    }
    if (!datasetGroupArn) {
      throw new Error("Missing datasetGroupArn")
    }
    if (!forecastHorizon) {
      throw new Error("Missing forecastHorizon")
    }

    return {
      forecastFrequency,
      accessKeyId,
      secretAccessKey,
      region,
      predictorName,
      datasetGroupArn,
      // TODO: handle case where this is NaN
      forecastHorizon: parseInt(forecastHorizon, 10),
    }
  }

  private forecastServiceFromRequest(request: Hub.ActionRequest) {
    return new ForecastService({
      region: request.params.region,
      accessKeyId: request.params.accessKeyId,
      secretAccessKey: request.params.secretAccessKey,
    })
  }
}

Hub.addAction(new ForecastTrainPredictorAction())
