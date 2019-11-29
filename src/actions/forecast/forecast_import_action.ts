import * as Hub from "../../hub"

import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import ForecastDataImport from "./forecast_import"
import { ForecastDataImportActionParams } from "./forecast_types"
import { poll } from "./poller"
import { uploadToS3 } from "./s3_upload"

// TODO: parseInt/Float on numeric cols from Looker, as they contain commas
export class ForecastDataImportAction extends Hub.Action {
  // TODO: make email-related fields required?
  name = "amazon_forecast_data_import"
  label = "Amazon Forecast Data Import"
  supportedActionTypes = [Hub.ActionType.Query]
  description = "Import data into Amazon Forecast"
  usesStreaming = true
  requiredFields = []
  supportedFormats = [Hub.ActionFormat.Csv]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
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
    // TODO: put results under /forecast-import and /forecast-export paths
    // so buckets can safely be the same or different
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

  // TODO: add description props to these fields
  // TODO: include "include country for holidays" field
  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    const forecastService = this.forecastServiceFromRequest(request)
    let datasetGroupOptions = [{ name: "New Group", label: "New Group" }]
    const { DatasetGroups } = await forecastService.listDatasetGroups().promise()
    if (DatasetGroups) {
      const currDatasetGroups = DatasetGroups
      .map((dg) => ({ name: dg.DatasetGroupArn!, label: dg.DatasetGroupName! }))
      // aws typings claim DatasetGroupArn/Name can be undefined, hence the filter
      .filter(({ name, label }) => name && label)
      datasetGroupOptions = datasetGroupOptions.concat(...currDatasetGroups)
    }

    const domainOptions = [
      "RETAIL",
       "CUSTOM",
       "INVENTORY_PLANNING",
       "EC2_CAPACITY",
       "WORK_FORCE",
       "WEB_TRAFFIC",
       "METRICS"]

    const dataFrequencyOptions = {
      "Y": "Yearly",
      "M": "Monthly",
      "W": "Weekly",
      "D": "Daily",
      "H": "Hourly",
      "30min": "Every 30 minutes",
      "15min": "Every 15 minutes",
      "10min": "Every 10 minutes",
      "5min": "Every 5 minutes",
      "1min": "Every minute",
    }

    form.fields = [
      {
        label: "Dataset group name",
        name: "datasetGroupName",
        required: true,
        type: "select",
        description: "Choose an existing dataset group, or create a new one",
        options: datasetGroupOptions,
      },
      {
        label: "Forecasting domain",
        name: "forecastingDomain",
        required: true,
        type: "select",
        options: domainOptions.map((str) => ({ name: str, label: str })),
        description: "Domain defines the forecasting use case. Choose CUSTOM if no other option applies",
      },
      {
        label: "Dataset name",
        name: "datasetName",
        required: true,
        type: "string",
        description: "choose a name to distinguish this dataset from others in the dataset group",
      },
      {
        label: "Data Frequency",
        name: "dataFrequency",
        required: true,
        type: "select",
        options: Object.entries(dataFrequencyOptions).map(([k, v]) => ({ name: k, label: v })),
        description: "This is the frequency at which entries are registered into your data file",
      },
      {
        label: "Data Schema",
        name: "dataSchema",
        required: true,
        type: "textarea",
        description: `To help Forecast understand the fields of your data, supply a schema.
        Specify attributes in the same order as your CSV file. See AWS documention for more details.`,
      },
      {
        label: "Timestamp Format",
        name: "timestampFormat",
        required: true,
        type: "string",
        default: "yyyy-MM-dd HH:mm:ss",
        description: `The format of the timestamp in your dataset.
        The format you enter here must match the format in your data file`,
      },
    ]
    return form
  }

  async execute(request: Hub.ActionRequest) {
    try {
      this.importFromS3ToForecast(request).catch(winston.error)
      // response acknowledges that import has started, not that it's complete
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      winston.error(JSON.stringify(err, null, 2))
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  // TODO: better function name?
  private async importFromS3ToForecast(request: Hub.ActionRequest) {
    const actionParams = this.getRequiredActionParamsFromRequest(request)
    const {
      bucketName,
      datasetName,
    } = actionParams
    // upload looker data to S3
    const s3ObjectKey = `${datasetName}_${Date.now()}.csv`
    await uploadToS3(request, bucketName, s3ObjectKey)

    // create Forecast dataset resource & feed in S3 data
    const forecastService = this.forecastServiceFromRequest(request)
    const forecastImport = new ForecastDataImport({ forecastService, s3ObjectKey, ...actionParams })
    await forecastImport.startResourceCreation()
    await poll(forecastImport.isResourceCreationComplete)
    // TODO: send email on success or failure
  }

  private getRequiredActionParamsFromRequest(request: Hub.ActionRequest): ForecastDataImportActionParams {
    const {
      datasetName,
      datasetGroupName,
      forecastingDomain,
      dataFrequency,
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

Hub.addAction(new ForecastDataImportAction())
