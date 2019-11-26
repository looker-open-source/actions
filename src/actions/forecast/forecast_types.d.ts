// TODO: add interface for ForecastWorkflowStep

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
  predictorName: string
}