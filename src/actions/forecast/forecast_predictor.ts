import * as ForecastService from "aws-sdk/clients/forecastservice"
import { ForecastTrainPredictorActionParams, ForecastWorkflowStage } from "./forecast_types"

interface ForecastPredictorParams extends ForecastTrainPredictorActionParams {
  forecastService: ForecastService
}

export default class ForecastPredictor implements ForecastWorkflowStage {
  private forecastService: ForecastService
  private forecastFrequency: string
  private datasetGroupArn: string
  private predictorName: string
  private forecastHorizon: number
  private predictorArn?: string

  constructor(params: ForecastPredictorParams) {
    this.forecastService = params.forecastService
    this.forecastFrequency = params.forecastFrequency
    this.datasetGroupArn = params.datasetGroupArn
    this.predictorName = params.predictorName
    this.forecastHorizon = params.forecastHorizon
    this.getResourceCreationStatus = this.getResourceCreationStatus.bind(this)
  }

  async startResourceCreation() {
    await this.createPredictor()
  }

  async getResourceCreationStatus() {
    if (!this.predictorArn) {
      return ""
    }
    const { Status } = await this.forecastService.describePredictor({
      PredictorArn: this.predictorArn,
    }).promise()
    return Status ? Status : ""
  }

  private async createPredictor() {
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
