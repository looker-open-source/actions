/* tslint:disable max-line-length */
import * as SageMaker from "aws-sdk/clients/sagemaker"
import * as nodemailer from "nodemailer"
import * as winston from "winston"
import * as Hub from "../../hub"
import { getMailTransporter } from "./mail_transporter"
import { logRejection } from "./utils"

export const FIVE_MINUTES = 1000 * 60 * 5
export const THIRTY_SECONDS = 1000 * 30

export interface Transaction {
  request: Hub.ActionRequest
  sagemaker: SageMaker
  modelName: string
  jobName: string
  roleArn: string
  trainingImage: string
  maxRuntimeInSeconds: number
  pollIntervalInSeconds: number
}

export class TrainingJobPoller {

  transporter: nodemailer.Transporter
  intervalTimer: any
  timeoutTimer: any

  constructor(transaction: Transaction) {
    this.transporter = getMailTransporter(transaction.request)
    this.pollTrainingJob(transaction).catch(logRejection)
  }

  async pollTrainingJob(transaction: Transaction) {
      // start poller for training job completion
      winston.debug("starting poller")

      this.intervalTimer = setInterval(() => {
        this.checkTrainingJob(transaction).catch(logRejection)
      }, transaction.pollIntervalInSeconds)

      this.timeoutTimer = setTimeout(() => {
        clearInterval(this.intervalTimer)
        this.sendTrainingTimeoutEmail(transaction).catch(logRejection)
      }, transaction.maxRuntimeInSeconds * 1000)
  }

  async checkTrainingJob(transaction: Transaction) {
    winston.debug("polling training job status")
    const params = {
      TrainingJobName: transaction.jobName,
    }
    const response = await transaction.sagemaker.describeTrainingJob(params).promise()
    winston.debug("describeTrainingJob response", response)
    winston.debug("status", response.TrainingJobStatus)

    switch (response.TrainingJobStatus) {
      case "Completed":
        this.stopPolling()
        this.createModel(transaction, response).catch(logRejection)
        break
      case "Failed":
        this.stopPolling()
        this.sendTrainingFailedEmail(transaction, response).catch(logRejection)
        break
      case "Stopped":
        this.stopPolling()
        this.sendTrainingStoppedEmail(transaction, response).catch(logRejection)
        break
    }
  }

  stopPolling() {
    winston.debug("stopping poller")

    clearInterval(this.intervalTimer)
    clearTimeout(this.timeoutTimer)
  }

  async sendTrainingTimeoutEmail(transaction: Transaction) {
    winston.debug("sendTrainingTimeoutEmail")
    this.transporter.sendMail({
      subject: `Training job ${transaction.jobName} timed out`,
      text: `The training job ${transaction.jobName} exceeded the maximum run time of ${transaction.maxRuntimeInSeconds} seconds.`,
    })
    .catch(logRejection)
  }

  async sendTrainingFailedEmail(transaction: Transaction, response: SageMaker.DescribeTrainingJobResponse) {
    winston.debug("sendTrainingFailedEmail")
    this.transporter.sendMail({
      subject: `Training job ${transaction.jobName} failed`,
      text: `
        The training job ${transaction.jobName} failed. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
    })
    .catch(logRejection)
  }

  async sendTrainingStoppedEmail(transaction: Transaction, response: SageMaker.DescribeTrainingJobResponse) {
    winston.debug("sendTrainingStoppedEmail")
    this.transporter.sendMail({
      subject: `Training job ${transaction.jobName} was stopped`,
      text: `
        The training job ${transaction.jobName} was stopped. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
    })
    .catch(logRejection)
  }

  async sendCreateModelSuccessEmail(transaction: Transaction, response: SageMaker.CreateModelOutput) {
    winston.debug("sendCreateModelSuccessEmail")
    this.transporter.sendMail({
      subject: `The model ${transaction.modelName} has been created`,
      text: `
        The model ${transaction.modelName} has been created. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
    })
    .catch(logRejection)
  }

  async sendCreateModelFailureEmail(transaction: Transaction, response: SageMaker.CreateModelOutput) {
    winston.debug("sendCreateModelFailureEmail")
    this.transporter.sendMail({
      subject: `The model ${transaction.modelName} could not be created`,
      text: `
        The model ${transaction.modelName} could not be created. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
    })
    .catch(logRejection)
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
      const response = await transaction.sagemaker.createModel(params).promise()
      winston.debug("createModel response", response)
      this.sendCreateModelSuccessEmail(transaction, response).catch(logRejection)
    } catch (err) {
      this.sendCreateModelFailureEmail(transaction, err).catch(logRejection)
    }
  }

}
