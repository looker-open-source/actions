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
  forecastFrequency: string
  predictorName: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  forecastHorizon: number
}

export interface ForecastGenerateActionParams {
  accessKeyId: string
  secretAccessKey: string
  region: string
  forecastName: string
  predictorArn: string
}

export interface ForecastExportActionParams {
  bucketName: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  roleArn: string
  forecastArn: string
}

export interface ForecastWorkflowStage {
  startResourceCreation: () => Promise<void>
  isResourceCreationComplete: () => Promise<boolean>
}
