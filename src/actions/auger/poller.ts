/* tslint:disable max-line-length */
import * as winston from "winston"

export interface Transaction {
  projectId: number
  fileName: string
  s3Path: string
  token: any
  url: string
  modelType: any
  records: any[],
  augerURL: string,
  successStatus: string,
  errorStatus: string,
  pollFunction?: (transaction: Transaction) => Promise<any>,
  callbackFunction?: (transaction: Transaction) => Promise<any>,
  projectFileId: number,
  experimentId: number
}

export class Poller {

  intervalTimer: any
  timeoutTimer: any

  constructor(transaction: Transaction) {
    this.pollTrainingJob(transaction).catch(this.logRejection)
  }

  async pollTrainingJob(transaction: Transaction) {
    // start poller for training job completion
    winston.debug("starting poller")

    this.intervalTimer = setInterval(() => {
      this.checkStatus(transaction).catch(this.logRejection)
    }, 10 * 1000)

    this.timeoutTimer = setTimeout(() => {
      clearInterval(this.intervalTimer)
      this.logRejection
    }, 180 * 1000)
  }

  async checkStatus(transaction: Transaction) {
    winston.debug("polling training job status")
    if (!transaction.pollFunction || !transaction.callbackFunction)  {
      throw new Error("pollFunction or callback not defined")
    }
    const response = await transaction.pollFunction(transaction)
    const status = response.body.data.status || response.body.data.search_space_status
    winston.debug("response status", status)
    switch (status) {
      case transaction.successStatus:
        winston.debug("polling running")
        this.stopPolling()
        await transaction.callbackFunction(transaction)
        break
      case transaction.errorStatus:
        winston.debug("polling undeployed")
        this.stopPolling()
        break
    }
  }

  stopPolling() {
    winston.debug("stopping poller")

    clearInterval(this.intervalTimer)
    clearTimeout(this.timeoutTimer)
  }

  logRejection(err: any) {
    winston.debug(err)
  }

}
