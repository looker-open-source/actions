import * as Hub from "../../hub"

import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as S3 from "aws-sdk/clients/s3"
import * as winston from "winston"
import ForecastQueryExporter from "./forecast_export"
import { ForecastExportActionParams } from "./forecast_types"
import { poll } from "./poller"

// TODO: change nomenclature: export -> generate prediction
export class ForecastExportAction extends Hub.Action {
  // required fields
  // TODO: make email-related fields required
  name = "amazon_forecast_export"
  label = "Amazon Forecast Export"
  description = "Import data into Amazon Forecast, train a model, and generate a forecast from that model"
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
    // TODO: put results under /forecast-import
    // and /forecast-export paths so buckets can safely be the same or different
    {
      name: "bucketName",
      label: "Bucket Name",
      required: true,
      sensitive: false,
      description: "Name of the bucket Amazon Forecast will write prediction to",
    },
    {
      name: "roleArn",
      label: "Role ARN",
      required: true,
      sensitive: false,
      description: "ARN of role allowing Forecast to write to your S3 bucket",
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
    const bucketOptions = await this.listBuckets(request)

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
      { // TODO: should I eliminate this input and use the predictor name  + _forecast_export
        // that way there is less user input required
        label: "Forecast Name",
        name: "forecastName",
        required: true,
        type: "string",
        description: "Choose a name to identify this forecast",
      },
      {
        label: "Forecast Destination Bucket",
        name: "bucketName",
        required: true,
        type: "select",
        description: "Choose a destination bucket for your forecast",
        options: bucketOptions.map(({ Name }) => ({ name: Name!, label: Name! })),
      },
    ]
    return form
  }

  async execute(request: Hub.ActionRequest) {
    try {
      this.generateForecastAndExport(request).catch(winston.error)
      // response acknowledges that workflow has started, not that it's complete
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      winston.error(JSON.stringify(err, null, 2))
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  // TODO: different method name?
  private async generateForecastAndExport(request: Hub.ActionRequest) {
    const actionParams = this.getRequiredActionParamsFromRequest(request)
    const {
      accessKeyId,
      secretAccessKey,
      region,
    } = actionParams
    // create Forecast dataset resource & feed in S3 data
    const forecastService = new ForecastService({ accessKeyId, secretAccessKey, region })
    const forecastQueryExporter = new ForecastQueryExporter({
      forecastService,
      ...actionParams,
    })
    await forecastQueryExporter.startResourceCreation()
    await poll(forecastQueryExporter.isResourceCreationComplete)
    // TODO: send email on success/failure
  }

  private async listBuckets(request: Hub.ActionRequest) {
    const s3 = new S3({
      accessKeyId: request.params.accessKeyId,
      secretAccessKey: request.params.secretAccessKey,
    })
    const results = []
    const { Buckets } = await s3.listBuckets().promise()
    if (Buckets) {
      results.push(...Buckets)
    }
    return results
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

  private getRequiredActionParamsFromRequest(request: Hub.ActionRequest): ForecastExportActionParams {
    const {
      predictorArn,
      forecastName,
    } = request.formParams

    const {
      bucketName,
      accessKeyId,
      secretAccessKey,
      region,
      roleArn,
    } = request.params
    // TODO: make required params checking more compact?
    // TODO: are there AWS naming rules that I need to enforce in the UI?
    if (!bucketName) {
      throw new Error("Missing bucketName")
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
    if (!roleArn) {
      throw new Error("Missing roleArn")
    }
    if (!predictorArn) {
      throw new Error("Missing predictorArn")
    }
    if (!forecastName) {
      throw new Error("Missing forecastName")
    }

    return {
      bucketName,
      accessKeyId,
      secretAccessKey,
      region,
      roleArn,
      predictorArn,
      forecastName,
    }
  }
}

Hub.addAction(new ForecastExportAction())
