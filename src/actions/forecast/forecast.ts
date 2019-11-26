import * as Hub from "../../hub"

import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as S3 from "aws-sdk/clients/s3"
import { PassThrough } from "stream"
import * as winston from "winston"
import ForecastDataImport from "./forecast_import"
import ForecastPredictor from "./forecast_predictor"
import { ForecastActionParams } from "./forecast_types"

const striplines = require("striplines")

// TODO: parseInt/Float on numeric cols from Looker, as they contain commas
// TODO: maybe move polling logic to its own class
const MINUTE_MS = 60000
const POLL_INTERVAL_MS = MINUTE_MS
const MAX_POLL_ATTEMPTS = 60
const POLL_TIMEOUT = MINUTE_MS * MAX_POLL_ATTEMPTS

export class ForecastAction extends Hub.Action {
  // required fields
  // TODO: make email-related fields required?
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
      name: "bucketName",
      label: "Bucket Name",
      required: true,
      sensitive: false,
      description: "Name of the bucket Amazon Forecast will read your Looker data from",
    },
    {
      name: "roleArn",
      label: "Role ARN",
      required: true,
      sensitive: false,
      description: "ARN of role allowing Forecast to read from your S3 bucket",
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
  supportedFormats = [Hub.ActionFormat.Csv]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  // iconName = "" // TODO

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
        required: false,
        type: "string",
      },
      {
        label: "Forecasting domain",
        name: "forecastingDomain",
        required: false,
        type: "string",
      },
      {
        label: "Dataset name",
        name: "datasetName",
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
        label: "Data Schema",
        name: "dataSchema",
        required: false,
        type: "string",
      },
      {
        label: "Timestamp Format",
        name: "timestampFormat",
        required: false,
        type: "string",
      },
      {
        label: "Predictor Name",
        name: "predictorName",
        required: false,
        type: "string",
      },
      {
        label: "Forecast Horizon",
        name: "forecastHorizon",
        required: false,
        type: "string",
      },
      {
        label: "Forecast Name",
        name: "forecastName",
        required: false,
        type: "string",
      },
      {
        label: "Forecast Destination Bucket",
        name: "forecastDestinationBucket",
        required: false,
        type: "string",
      },
    ]
    return form
  }

  async execute(request: Hub.ActionRequest) {
    try {
      this.startForecastWorkflow(request).catch(winston.error)
      // response acknowledges that workflow has started, not that it's complete
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      winston.error(JSON.stringify(err, null, 2))
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  private async startForecastWorkflow(request: Hub.ActionRequest) {
    const actionParams = this.getRequiredActionParamsFromRequest(request)
    const {
      accessKeyId,
      secretAccessKey,
      region,
      bucketName,
      datasetName,
    } = actionParams
    // upload looker data to S3
    const s3ObjectKey = `${datasetName}_${Date.now()}.csv`
    await this.uploadToS3(request, bucketName, s3ObjectKey)

    // feed data in S3 to Forecast
    const forecastService = new ForecastService({ accessKeyId, secretAccessKey, region })
    const forecastImport = new ForecastDataImport({ forecastService, s3ObjectKey, ...actionParams })
    await forecastImport.startResourceCreation()
    await this.pollFor(forecastImport.checkResourceCreationComplete)

    // build Forecast predictor
    const forecastPredictor = new ForecastPredictor({
      forecastService,
      datasetGroupArn: forecastImport.datasetGroupArn!,
      ...actionParams,
    })
    await forecastPredictor.startResourceCreation()
    await this.pollFor(forecastPredictor.checkResourceCreationComplete)
  }

  private getRequiredActionParamsFromRequest(request: Hub.ActionRequest): ForecastActionParams {
    const {
      datasetName,
      datasetGroupName,
      forecastingDomain,
      dataFrequency,
      predictorName,
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
    if (!datasetName) {
      throw new Error("Missing datasetName")
    }
    if (!datasetGroupName) {
      throw new Error("Missing datasetGroupName")
    }
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
    if (!roleArn) {
      throw new Error("Missing roleArn")
    }
    if (!predictorName) {
      throw new Error("Missing predictorName")
    }

    return {
      bucketName,
      datasetName,
      datasetGroupName,
      forecastingDomain,
      dataFrequency,
      accessKeyId,
      secretAccessKey,
      region,
      roleArn,
      predictorName,
    }
  }

  private async pollFor(
    checkJobComplete: () => Promise<boolean>,
    pollsRemaining: number = MAX_POLL_ATTEMPTS): Promise<boolean> {
    winston.debug("polls remaining ", pollsRemaining)
    if (pollsRemaining <= 0) {
      // TODO: return false and log here instead?
      throw new Error(`dataset import job did not complete within ${POLL_TIMEOUT} miliseconds`)
    }
    const jobComplete = await checkJobComplete()

    if (jobComplete) {
      return true
    }
    // job not done, so sleep for POLL_INTERVAL_MS
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

    return this.pollFor(checkJobComplete, pollsRemaining - 1)
  }

  // TODO: this may belong in its own module
  private async uploadToS3(request: Hub.ActionRequest, bucket: string, key: string) {
    return new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
      const s3 = new S3({
        accessKeyId: request.params.accessKeyId,
        secretAccessKey: request.params.secretAccessKey,
      })

      function uploadFromStream() {
        winston.debug("calling uploadFromStream")
        const passthrough = new PassThrough()

        const params = {
          Bucket: bucket,
          Key: key,
          Body: passthrough,
        }
        s3.upload(params, (err: Error|null, data: S3.ManagedUpload.SendData) => {
          winston.debug("calling s3.upload")
          if (err) {
            return reject(err)
          }
          resolve(data)
        })

        return passthrough
      }

      request.stream(async (readable) => {
        readable
          .pipe(striplines(1))
          .pipe(uploadFromStream())
      }) // TODO: is this sensible error handle behavior?
      .catch(winston.error)
    })
  }
}

Hub.addAction(new ForecastAction())
