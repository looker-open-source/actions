import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { ForecastDataImportActionParams, ForecastWorkflowStage } from "./forecast_types"

interface ForecastDataImportParams extends ForecastDataImportActionParams {
  forecastService: ForecastService
  s3ObjectKey: string
}

export default class ForecastDataImport implements ForecastWorkflowStage {
  private forecastService: ForecastService
  private s3ObjectKey: string
  private bucketName: string
  private datasetName: string
  private forecastingDomain: string
  private dataFrequency: string
  private roleArn: string
  private timestampFormat: string
  private datasetArn?: string
  private datasetGroupArn?: string
  private datasetImportJobArn?: string

  constructor(params: ForecastDataImportParams) {
    this.forecastService = params.forecastService
    this.s3ObjectKey = params.s3ObjectKey
    this.bucketName = params.bucketName
    this.datasetName = params.datasetName
    this.datasetGroupArn = params.datasetGroupArn
    this.forecastingDomain = params.forecastingDomain
    this.dataFrequency = params.dataFrequency
    this.roleArn = params.roleArn
    this.timestampFormat = params.timestampFormat
    this.isResourceCreationComplete = this.isResourceCreationComplete.bind(this)
  }

  async startResourceCreation() {
    await this.createDataset()
    await this.createDatasetGroup()
    await this.createDatasetImportJob()
  }

  // TODO: handle case where job is done because failure has occured (i.e. Status !== ACTIVE)
  async isResourceCreationComplete() {
    if (!this.datasetImportJobArn) {
      return false
    }
    const { Status } = await this.forecastService.describeDatasetImportJob({
      DatasetImportJobArn: this.datasetImportJobArn,
    }).promise()
    winston.debug("describeDatasetImportJob polling complete: ", Status === "ACTIVE")
    return Status === "ACTIVE"
  }

  private async createDataset() {
    const params = {
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

    const { DatasetArn } = await this.forecastService.createDataset(params).promise()
    this.datasetArn = DatasetArn
  }

  private async createDatasetGroup() {
    if (!this.datasetGroupArn) {
      const params = {
        DatasetGroupName: `${this.datasetName}_group`,
        Domain: this.forecastingDomain,
        DatasetArns: [
          this.datasetArn!, // TODO: is there a valid case in which the DatasetArn would be undefined?
        ],
      }
      const { DatasetGroupArn } = await this.forecastService.createDatasetGroup(params).promise()
      this.datasetGroupArn = DatasetGroupArn!
    }
  }

  private async createDatasetImportJob() {
    const params = {
      DataSource: {
        S3Config: {
          Path: `s3://${this.bucketName}/${this.s3ObjectKey}`,
          RoleArn: this.roleArn,
        },
      },
      DatasetArn: this.datasetArn!,
      DatasetImportJobName: `${this.datasetName}_import_job`,
      TimestampFormat: this.timestampFormat,
    }

    const {
      DatasetImportJobArn,
    } = await this.forecastService.createDatasetImportJob(params).promise()
    this.datasetImportJobArn = DatasetImportJobArn
  }
}
