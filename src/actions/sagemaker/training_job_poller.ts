/* tslint:disable max-line-length */
import * as SageMaker from "aws-sdk/clients/sagemaker"

import * as winston from "winston"

export const FIVE_MINUTES = 1000 * 60 * 5
export const THIRTY_SECONDS = 1000 * 30

function logJson(label: string, obj: any) {
  winston.debug(label, JSON.stringify(obj, null, 2))
}

export interface Transaction {
  client: SageMaker
  modelName: string
  jobName: string
  roleArn: string
  trainingImage: string
  maxRuntimeInSeconds: number
  pollIntervalInSeconds: number
}

export class TrainingJobPoller {

  intervalTimer: any
  timeoutTimer: any

  constructor(transaction: Transaction) {
    this.pollTrainingJob(transaction)
  }

  async pollTrainingJob(transaction: Transaction) {
      // start poller for training job completion
      winston.debug("polling training job status")
      this.intervalTimer = setInterval(() => {
        this.checkTrainingJob(transaction)
      }, transaction.pollIntervalInSeconds)
      this.timeoutTimer = setTimeout(() => {
        clearInterval(this.intervalTimer)
        this.sendTrainingTimeoutEmail(transaction)
      }, transaction.maxRuntimeInSeconds * 1000)
  }

  async checkTrainingJob(transaction: Transaction) {
    const params = {
      TrainingJobName: transaction.jobName,
    }
    const response = await transaction.client.describeTrainingJob(params).promise()
    logJson("describeTrainingJob response", response)

    winston.debug("status", response.TrainingJobStatus)

    switch (response.TrainingJobStatus) {
      case "Completed":
        clearInterval(this.intervalTimer)
        clearTimeout(this.timeoutTimer)
        this.createModel(transaction, response)
        break
      case "Failed":
        clearInterval(this.intervalTimer)
        clearTimeout(this.timeoutTimer)
        this.sendTrainingFailedEmail(transaction, response)
        break
      case "Stopped":
        clearInterval(this.intervalTimer)
        clearTimeout(this.timeoutTimer)
        this.sendTrainingStoppedEmail(transaction, response)
        break
    }
  }

  async sendTrainingTimeoutEmail(_transaction: Transaction) {
    winston.debug("sendTrainingTimeoutEmail")
  }

  async sendTrainingFailedEmail(_transaction: Transaction, _response: SageMaker.DescribeTrainingJobResponse) {
    winston.debug("sendTrainingFailedEmail")
  }

  async sendTrainingStoppedEmail(_transaction: Transaction, _response: SageMaker.DescribeTrainingJobResponse) {
    winston.debug("sendTrainingFailedEmail")
  }

  async sendCreateModelSuccessEmail(_transaction: Transaction) {
    winston.debug("sendCreateModelSuccessEmail")
  }

  async sendCreateModelFailureEmail(_transaction: Transaction) {
    winston.debug("sendCreateModelFailureEmail")
  }

  async createModel(transaction: Transaction, trainingResponse: SageMaker.DescribeTrainingJobResponse) {
    const params: SageMaker.CreateModelInput = {
      ModelName: transaction.modelName,
      PrimaryContainer: {
        Image: transaction.trainingImage,
        ModelDataUrl: trainingResponse.ModelArtifacts.S3ModelArtifacts,
      },
      ExecutionRoleArn: transaction.roleArn,
    }
    try {
      const response = await transaction.client.createModel(params).promise()
      logJson("createModel response", response)
      this.sendCreateModelSuccessEmail(transaction)
    } catch (err) {
      this.sendCreateModelFailureEmail(transaction)
    }
  }

}
