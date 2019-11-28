import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { ForecastExportActionParams, ForecastWorkflowStage } from "./forecast_types"

interface ForecastExportParams extends ForecastExportActionParams {
  forecastService: ForecastService
}

export default class ForecastExport implements ForecastWorkflowStage {
  private forecastService: ForecastService
  private forecastName: string
  private predictorArn: string
  private bucketName: string
  private roleArn: string
  private forecastArn: string | undefined
  private forecastExportJobArn: string | undefined

  constructor(params: ForecastExportParams) {
    this.forecastService = params.forecastService
    this.forecastName = params.forecastName
    this.predictorArn = params.predictorArn
    this.bucketName = params.bucketName
    this.roleArn = params.roleArn
    this.isResourceCreationComplete = this.isResourceCreationComplete.bind(this)
  }

  async startResourceCreation() {
    await this.createForecast()
    await this.createForecastExportJob()
  }
  // TODO: handle case where job is done because failure has occured (i.e. Status !== ACTIVE)
  async isResourceCreationComplete() {
    if (!this.forecastExportJobArn) {
      return false
    }
    const { Status } = await this.forecastService.describeForecastExportJob({
      ForecastExportJobArn: this.forecastExportJobArn,
    }).promise()
    winston.debug("describeForecastExportJob polling complete: ", Status === "ACTIVE")
    return Status === "ACTIVE"
  }

  private async createForecast() {
    const params = {
      ForecastName: this.forecastName,
      PredictorArn: this.predictorArn,
    }
    const { ForecastArn } = await this.forecastService.createForecast(params).promise()
    this.forecastArn = ForecastArn
  }

  private async createForecastExportJob() {
    const params = {
      Destination: {
        S3Config: {
          Path: `s3://${this.bucketName}/ForecastExport/`,
          RoleArn: this.roleArn,
        },
      },
      ForecastArn: this.forecastArn!,
      ForecastExportJobName: `${this.forecastName}_export_${Date.now()}`,
    }
    const { ForecastExportJobArn } = await this.forecastService.createForecastExportJob(params).promise()
    this.forecastExportJobArn = ForecastExportJobArn
  }
}