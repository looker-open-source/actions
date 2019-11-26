import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { ForecastActionParams } from "./forecast_types"

interface ForecastDataImportParams extends ForecastActionParams {
  forecastService: ForecastService
  s3ObjectKey: string
}

export default class ForecastDataImport {
  private datasetImportJobArn: string | undefined
  private forecastService: ForecastService
  private s3ObjectKey: string
  private bucketName: string
  private datasetName: string
  private datasetGroupName: string
  private forecastingDomain: string
  private dataFrequency: string
  private roleArn: string
  private datasetArn: string | undefined

  constructor(params: ForecastDataImportParams) {
    this.forecastService = params.forecastService
    this.s3ObjectKey = params.s3ObjectKey
    this.bucketName = params.bucketName
    this.datasetName = params.datasetName
    this.datasetGroupName = params.datasetGroupName
    this.forecastingDomain = params.forecastingDomain
    this.dataFrequency = params.dataFrequency
    this.roleArn = params.roleArn
    this.checkResourceCreationComplete = this.checkResourceCreationComplete.bind(this)
  }

  async startResourceCreation() {
    await this.createDataset()
    await this.createDatasetGroup()
    await this.createDatasetImportJob()
  }

  // TODO: handle case where job is done because failure has occured (i.e. Status !== ACTIVE)
  // TODO: when poller is moved into its own class, make function argument here a private method
  // tslint:disable-next-line
  async checkResourceCreationComplete() {
    const { Status } = await this.forecastService.describeDatasetImportJob({
      DatasetImportJobArn: this.datasetImportJobArn!, // TODO: Could the arn be undefined in some case
    }).promise()
    winston.debug("polling complete: ", Status === "ACTIVE")
    return Status === "ACTIVE" ? Status : null
  }

  private async createDataset() {
    const createDatasetParams = {
      DatasetName: this.datasetName,
      DatasetType: "TARGET_TIME_SERIES", // TODO: there are other possible values here, do I need to consider them?
      Domain: this.forecastingDomain,
      Schema: { // TODO: schema hardcoded for now. What's the best way to make this work dynamically?
        Attributes: [
          {
            AttributeName: "timestamp",
            AttributeType: "timestamp",
          },
          {
            AttributeName: "item_id",
            AttributeType: "string",
          },
          {
            AttributeName: "target_value",
            AttributeType: "float",
          },
        ],
      },
      DataFrequency: this.dataFrequency,
    }

    const { DatasetArn } = await this.forecastService.createDataset(createDatasetParams).promise()
    this.datasetArn = DatasetArn
  }

  private async createDatasetGroup() {
    const createDatasetGroupParams = {
      DatasetGroupName: this.datasetGroupName,
      Domain: this.forecastingDomain,
      DatasetArns: [
        this.datasetArn!, // TODO: is there a valid case in which the DatasetArn would be undefined?
      ],
    }

    await this.forecastService.createDatasetGroup(createDatasetGroupParams).promise()
  }

  private async createDatasetImportJob() {
    const createDatasetImportJobParams = {
      DataSource: {
        S3Config: {
          Path: `s3://${this.bucketName}/${this.s3ObjectKey}`,
          RoleArn: this.roleArn,
        },
      },
      DatasetArn: this.datasetArn!,
      DatasetImportJobName: `${this.datasetName}_import_job`,
      TimestampFormat: "yyyy-MM-dd", // TODO: make this dynamic based on frequency selection
    }

    const {
      DatasetImportJobArn,
    } = await this.forecastService.createDatasetImportJob(createDatasetImportJobParams).promise()
    this.datasetImportJobArn = DatasetImportJobArn
  }
}