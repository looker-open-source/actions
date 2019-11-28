export interface ForecastActionParams {
  bucketName: string
  datasetName: string
  datasetGroupName: string
  forecastingDomain: string
  dataFrequency: string
  accessKeyId: string
  secretAccessKey: string
  region: string
  roleArn: string
}

export interface ForecastWorkflowStage {
  startResourceCreation: () => Promise<void>
  isResourceCreationComplete: () => Promise<boolean>
}
