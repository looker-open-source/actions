import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { ForecastActionParams } from "./forecast_types"

interface ForecastPredictorParams extends ForecastActionParams {
  forecastService: ForecastService
  datasetGroupArn: string
}

export default class ForecastPredictor {
  predictorArn: string | undefined
  private forecastService: ForecastService
  private dataFrequency: string
  private datasetGroupArn: string
  private predictorName: string

  constructor(params: ForecastPredictorParams) {
    this.forecastService = params.forecastService
    this.dataFrequency = params.dataFrequency
    this.datasetGroupArn = params.datasetGroupArn
    this.predictorName = params.predictorName
    this.checkResourceCreationComplete = this.checkResourceCreationComplete.bind(this)
  }

  async startResourceCreation() {
    await this.createPredictor()
  }

  // TODO: handle case where job is done because failure has occured (i.e. Status !== ACTIVE)
  async checkResourceCreationComplete() {
    if (!this.predictorArn) {
      return false
    }
    const { Status } = await this.forecastService.describePredictor({
      PredictorArn: this.predictorArn,
    }).promise()
    winston.debug("describePredictor polling complete: ", Status === "ACTIVE")
    return Status === "ACTIVE"
  }

  private async createPredictor() {
    // TODO: any additonal params required here?
    const params = {
      FeaturizationConfig: {
        ForecastFrequency: this.dataFrequency,
      },
      ForecastHorizon: 50, // TODO: calculate this dynamically
      InputDataConfig: {
        DatasetGroupArn: this.datasetGroupArn,
      },
      PredictorName: this.predictorName,
      PerformAutoML: true,
    }
    const { PredictorArn } = await this.forecastService.createPredictor(params).promise()
    this.predictorArn = PredictorArn
  }
}
