import * as Hub from "../../hub"

import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import ForecastGenerate from "./forecast_generate"
import { ForecastGenerateActionParams } from "./forecast_types"
import { notifyJobStatus } from "./mail_transporter"
import { pollForCreateComplete } from "./poller"

export class ForecastGenerateAction extends Hub.Action {
  // TODO: make email-related fields required
  name = "amazon_forecast_export"
  label = "Amazon Forecast Export"
  description = "Generate timeseries forecast using Amazon Forecast"
  usesStreaming = true
  requiredFields = []
  supportedFormats = [Hub.ActionFormat.Csv]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  supportedActionTypes = [Hub.ActionType.Query]
  // iconName = "" // TODO

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

  async form(request: Hub.ActionRequest) {
    winston.debug(JSON.stringify(request.params, null, 2))
    const form = new Hub.ActionForm()
    const predictorOptions = await this.listPredictors(request)

    form.fields = [
      {
        label: "Predictor ARN",
        name: "predictorArn",
        required: true,
        type: "select",
        options: predictorOptions
        .map((p) => ({ name: p.PredictorArn!, label: p.PredictorName! })),
        description: "The predictor you want to use to create forecasts",
      },
      { // TODO: should I eliminate this input and use the predictor name  + _export + time
        // that way there is less user input required
        label: "Forecast Name",
        name: "forecastName",
        required: true,
        type: "string",
        description: "Choose a name to identify this forecast",
      },
    ]
    return form
  }

  async execute(request: Hub.ActionRequest) {
    try {
      this.startForecastGeneration(request)
      .catch(async (err) => this.handleFailure(request, err))
      // response acknowledges that workflow has started, not that it's complete
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      winston.error(JSON.stringify(err, null, 2))
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  private async startForecastGeneration(request: Hub.ActionRequest) {
    const actionParams = this.getRequiredActionParamsFromRequest(request)
    const {
      accessKeyId,
      secretAccessKey,
      region,
      forecastName,
    } = actionParams

    const forecastService = new ForecastService({ accessKeyId, secretAccessKey, region })
    const forecastGenerate = new ForecastGenerate({
      forecastService,
      ...actionParams,
    })
    await forecastGenerate.startResourceCreation()
    const { jobStatus } = await pollForCreateComplete(forecastGenerate.getResourceCreationStatus)
    // notify user of job result
    await notifyJobStatus(request, {
      action: this.label,
      status: jobStatus,
      resource: forecastName,
    })
  }

  private async handleFailure(request: Hub.ActionRequest, err: Error) {
    winston.error(JSON.stringify(err, null, 2))
    await notifyJobStatus(request, {
      action: request.actionId!,
      status: err.name,
      message: err.message,
    })
  }

  private async listPredictors(request: Hub.ActionRequest) {
    const forecastService = this.forecastServiceFromRequest(request)
    const { Predictors } = await forecastService.listPredictors().promise()
    const results = []
    if (Predictors) {
      results.push(...Predictors)
    }
    return results
  }

  private forecastServiceFromRequest(request: Hub.ActionRequest) {
    return new ForecastService({
      region: request.params.region,
      accessKeyId: request.params.accessKeyId,
      secretAccessKey: request.params.secretAccessKey,
    })
  }

  private getRequiredActionParamsFromRequest(request: Hub.ActionRequest): ForecastGenerateActionParams {
    const {
      predictorArn,
      forecastName,
    } = request.formParams

    const {
      accessKeyId,
      secretAccessKey,
      region,
    } = request.params
    // TODO: are there AWS naming rules that I need to enforce in the UI?
    if (!accessKeyId) {
      throw new Error("Missing accessKeyId")
    }
    if (!secretAccessKey) {
      throw new Error("Missing secretAccessKey")
    }
    if (!region) {
      throw new Error("Missing region")
    }
    if (!predictorArn) {
      throw new Error("Missing predictorArn")
    }
    if (!forecastName) {
      throw new Error("Missing forecastName")
    }

    return {
      accessKeyId,
      secretAccessKey,
      region,
      predictorArn,
      forecastName,
    }
  }
}

Hub.addAction(new ForecastGenerateAction())
