import * as ForecastService from "aws-sdk/clients/forecastservice"
import * as winston from "winston"
import { ForecastTrainPredictorActionParams, ForecastWorkflowStage } from "./forecast_types"

interface ForecastPredictorParams extends ForecastTrainPredictorActionParams {
  forecastService: ForecastService
}

export default class ForecastPredictor implements ForecastWorkflowStage {
  predictorArn: string | undefined
  private forecastService: ForecastService
  private forecastFrequency: string
  private datasetGroupArn: string
  private predictorName: string
  private forecastHorizon: number

  constructor(params: ForecastPredictorParams) {
    this.forecastService = params.forecastService
    this.forecastFrequency = params.forecastFrequency
    this.datasetGroupArn = params.datasetGroupArn
    this.predictorName = params.predictorName
    this.forecastHorizon = params.forecastHorizon
    this.isResourceCreationComplete = this.isResourceCreationComplete.bind(this)
  }

  async startResourceCreation() {
    await this.createPredictor()
  }

  // TODO: handle case where job is done because failure has occured (i.e. Status !== ACTIVE)
  async isResourceCreationComplete() {
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
        ForecastFrequency: this.forecastFrequency,
      },
      // TODO: include these parameters
      // EvaluationParameters: {
      //   BackTestWindowOffset: 'NUMBER_VALUE',
      //   NumberOfBacktestWindows: 'NUMBER_VALUE'
      // },
      ForecastHorizon: this.forecastHorizon,
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
