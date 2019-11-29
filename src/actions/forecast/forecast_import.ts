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
  private datasetSchema: any // TODO: fix this typing
  private datasetType: string
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
    this.datasetSchema = params.datasetSchema
    this.datasetType = params.datasetType
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
      DatasetType: this.datasetType,
      Domain: this.forecastingDomain,
      Schema: this.datasetSchema,
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
