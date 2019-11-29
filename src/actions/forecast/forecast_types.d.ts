export interface ForecastDataImportActionParams {
  bucketName: string
  datasetName: string
  datasetGroupArn?: string
  forecastingDomain: string
  dataFrequency: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  roleArn: string
  timestampFormat: string
  datasetSchema: string
  datasetType: string
}

export interface ForecastTrainPredictorActionParams {
  datasetGroupArn: string
  forecastingDomain: string
  dataFrequency: string
  predictorName: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  roleArn: string
  forecastHorizon: number
}

export interface ForecastExportActionParams {
  bucketName: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  roleArn: string
  predictorArn: string
  forecastName: string
}

export interface ForecastWorkflowStage {
  startResourceCreation: () => Promise<void>
  isResourceCreationComplete: () => Promise<boolean>
}
