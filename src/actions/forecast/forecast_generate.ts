import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { ForecastGenerateActionParams, ForecastWorkflowStage } from "./forecast_types"

interface ForecastGenerateParams extends ForecastGenerateActionParams {
  forecastService: ForecastService
}

export default class ForecastGenerate implements ForecastWorkflowStage {
  private forecastService: ForecastService
  private forecastName: string
  private predictorArn: string
  private forecastArn?: string

  constructor(params: ForecastGenerateParams) {
    this.forecastService = params.forecastService
    this.forecastName = params.forecastName
    this.predictorArn = params.predictorArn
    this.isResourceCreationComplete = this.isResourceCreationComplete.bind(this)
  }

  async startResourceCreation() {
    await this.createForecast()
  }
  // TODO: handle case where job is done because failure has occured (i.e. Status !== ACTIVE)
  async isResourceCreationComplete() {
    if (!this.forecastArn) {
      return false
    }
    const { Status } = await this.forecastService.describeForecast({
      ForecastArn: this.forecastArn,
    }).promise()
    winston.debug("describeForecast polling complete: ", Status === "ACTIVE")
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
}
