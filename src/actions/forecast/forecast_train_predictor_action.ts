import * as Hub from "../../hub"

import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import ForecastPredictor from "./forecast_predictor"
import { ForecastTrainPredictorActionParams } from "./forecast_types"
import { poll } from "./poller"

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

  async form(request: Hub.ActionRequest) {
    winston.debug(JSON.stringify(request.params, null, 2))
    const form = new Hub.ActionForm()
    // TODO: add description props to these fields
    // TODO: populate options
    // TODO: include extra params: "country for holidays", backtest window, other backtest param
    form.fields = [
      {
        label: "Dataset group ARN",
        name: "datasetGroupArn",
        required: false,
        type: "string",
      },
      {
        label: "Data Frequency",
        name: "dataFrequency",
        required: false,
        type: "string",
      },
      {
        label: "Predictor Name",
        name: "predictorName",
        required: false,
        type: "string",
      },
    ]
    return form
  }

  async execute(request: Hub.ActionRequest) {
    try {
      this.trainPredictorModel(request).catch(winston.error)
      // response acknowledges that predictor training has started, not that it's complete
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      winston.error(JSON.stringify(err, null, 2))
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  // TODO: better function name?
  private async trainPredictorModel(request: Hub.ActionRequest) {
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
    await poll(forecastPredictor.isResourceCreationComplete)
    // TODO: send email on success/fail?
  }

  private getRequiredActionParamsFromRequest(request: Hub.ActionRequest): ForecastTrainPredictorActionParams {
    const {
      datasetGroupArn,
      forecastingDomain,
      dataFrequency,
      predictorName,
    } = request.formParams

    const {
      accessKeyId,
      secretAccessKey,
      region,
      roleArn,
    } = request.params
    // TODO: make required params checking more compact?
    // TODO: are there AWS naming rules that I need to enforce in the UI?
    if (!forecastingDomain) {
      throw new Error("Missing forecastingDomain")
    }
    if (!dataFrequency) {
      throw new Error("Missing dataFrequency")
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
    if (!roleArn) {
      throw new Error("Missing roleArn")
    }

    return {
      forecastingDomain,
      dataFrequency,
      accessKeyId,
      secretAccessKey,
      region,
      predictorName,
      datasetGroupArn,
      roleArn,
    }
  }
}

Hub.addAction(new ForecastTrainPredictorAction())
