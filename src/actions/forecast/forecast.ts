import * as Hub from "../../hub"

import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as S3 from "aws-sdk/clients/s3"
import { PassThrough } from "stream"
import * as winston from "winston"

const striplines = require("striplines")

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
  // TODO: for which of these optional fields should I provide values?
  // iconName = ""
  // supportedFormats = [Hub.ActionFormat.Csv]
  // supportedFormattings = [Hub.ActionFormatting.Unformatted]
  // supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

    /* execution logic (this comment block will be removed)
     0. validate parameters
     1. upload payload from Looker to S3
     2. when upload is complete, create dataset
     3. create datasetgroup, specifying above-created dataset
     4. create predictor
     5. on predictor creation compelte, create a forecast
     6. on forecast complete, create a forecast export
     7. on forecast export complete, send email to user
    */
  async execute(request: Hub.ActionRequest) {
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

    try {
      // TODO: do I need to worry about bucket region?
      // TODO: calculate more meaningful object key?
      await this.uploadToS3(request, bucketName, new Date().toUTCString())

      const forecastService = new ForecastService({ accessKeyId, secretAccessKey, region })
      // TODO: possibly move some of these calls into private functions for improved readability
      const createDatasetParams = {
        DatasetName: datasetName,
        DatasetType: "TARGET_TIME_SERIES", // TODO: there are other possible values here, do I need to consider them?
        Domain: forecastingDomain,
        Schema: { // TODO: schema hardcoded for now. What's the best way to make this work dynamically?
          Attributes: [
            {
              AttributeName: "timestamp",
              AttributeType: "timestamp",
            },
            {
              AttributeName: "target_value",
              AttributeType: "float",
            },
            {
              AttributeName: "item_id",
              AttributeType: "string",
            },
          ],
        },
        DataFrequency: dataFrequency,
      }

      const { DatasetArn } = await forecastService.createDataset(createDatasetParams).promise()

      const createDatasetGroupParams = {
        DatasetGroupName: datasetGroupName,
        Domain: forecastingDomain,
        DatasetArns: [
          DatasetArn!, // TODO: is there a valid case in which the DatasetArn would be undefined?
        ],
      }

      await forecastService.createDatasetGroup(createDatasetGroupParams).promise()

      const createDatasetImportJobParams = {
        DataSource: {
          S3Config: {
            Path: `s3://${bucketName}/${datasetName}`,
            RoleArn: roleArn,
          },
        },
        DatasetArn: DatasetArn!,
        DatasetImportJobName: `${datasetName}_import_job`,
        // TimestampFormat TODO: right now, we're using default timestamp format. Allow for customization here
      }

      await forecastService.createDatasetImportJob(createDatasetImportJobParams).promise()

      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      winston.error(JSON.stringify(err, null, 2))
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
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

  private async uploadToS3(request: Hub.ActionRequest, bucket: string, key: string) {
    return new Promise<S3.ManagedUpload.SendData>((resolve, reject) => {
      const s3 = new S3({
        accessKeyId: request.params.accessKeyId,
        secretAccessKey: request.params.secretAccessKey,
      })

      function uploadFromStream() {
        const passthrough = new PassThrough()

        const params = {
          Bucket: bucket,
          Key: key,
          Body: passthrough,
        }
        s3.upload(params, (err: Error|null, data: S3.ManagedUpload.SendData) => {
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
