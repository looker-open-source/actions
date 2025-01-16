"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingJobPoller = exports.THIRTY_SECONDS = exports.FIVE_MINUTES = void 0;
const winston = require("winston");
const mail_transporter_1 = require("./mail_transporter");
const utils_1 = require("./utils");
exports.FIVE_MINUTES = 1000 * 60 * 5;
exports.THIRTY_SECONDS = 1000 * 30;
class TrainingJobPoller {
    constructor(transaction) {
        this.transporter = (0, mail_transporter_1.getMailTransporter)(transaction.request);
        this.pollTrainingJob(transaction).catch(utils_1.logRejection);
    }
    async pollTrainingJob(transaction) {
        // start poller for training job completion
        winston.debug("starting poller");
        this.intervalTimer = setInterval(() => {
            this.checkTrainingJob(transaction).catch(utils_1.logRejection);
        }, transaction.pollIntervalInSeconds);
        this.timeoutTimer = setTimeout(() => {
            clearInterval(this.intervalTimer);
            this.sendTrainingTimeoutEmail(transaction).catch(utils_1.logRejection);
        }, transaction.maxRuntimeInSeconds * 1000);
    }
    async checkTrainingJob(transaction) {
        winston.debug("polling training job status");
        const params = {
            TrainingJobName: transaction.jobName,
        };
        const response = await transaction.sagemaker.describeTrainingJob(params).promise();
        winston.debug("describeTrainingJob response", response);
        winston.debug("status", response.TrainingJobStatus);
        switch (response.TrainingJobStatus) {
            case "Completed":
                this.stopPolling();
                this.createModel(transaction, response).catch(utils_1.logRejection);
                break;
            case "Failed":
                this.stopPolling();
                this.sendTrainingFailedEmail(transaction, response).catch(utils_1.logRejection);
                break;
            case "Stopped":
                this.stopPolling();
                this.sendTrainingStoppedEmail(transaction, response).catch(utils_1.logRejection);
                break;
        }
    }
    stopPolling() {
        winston.debug("stopping poller");
        clearInterval(this.intervalTimer);
        clearTimeout(this.timeoutTimer);
    }
    async sendTrainingTimeoutEmail(transaction) {
        winston.debug("sendTrainingTimeoutEmail");
        this.transporter.sendMail({
            subject: `Training job ${transaction.jobName} timed out`,
            text: `The training job ${transaction.jobName} exceeded the maximum run time of ${transaction.maxRuntimeInSeconds} seconds.`,
        })
            .catch(utils_1.logRejection);
    }
    async sendTrainingFailedEmail(transaction, response) {
        winston.debug("sendTrainingFailedEmail");
        this.transporter.sendMail({
            subject: `Training job ${transaction.jobName} failed`,
            text: `
        The training job ${transaction.jobName} failed. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
        })
            .catch(utils_1.logRejection);
    }
    async sendTrainingStoppedEmail(transaction, response) {
        winston.debug("sendTrainingStoppedEmail");
        this.transporter.sendMail({
            subject: `Training job ${transaction.jobName} was stopped`,
            text: `
        The training job ${transaction.jobName} was stopped. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
        })
            .catch(utils_1.logRejection);
    }
    async sendCreateModelSuccessEmail(transaction, response) {
        winston.debug("sendCreateModelSuccessEmail");
        this.transporter.sendMail({
            subject: `The model ${transaction.modelName} has been created`,
            text: `
        The model ${transaction.modelName} has been created. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
        })
            .catch(utils_1.logRejection);
    }
    async sendCreateModelFailureEmail(transaction, response) {
        winston.debug("sendCreateModelFailureEmail");
        this.transporter.sendMail({
            subject: `The model ${transaction.modelName} could not be created`,
            text: `
        The model ${transaction.modelName} could not be created. Here is the SageMaker API response:

        ${JSON.stringify(response)}
      `,
        })
            .catch(utils_1.logRejection);
    }
    async createModel(transaction, trainingResponse) {
        const params = {
            ModelName: transaction.modelName,
            PrimaryContainer: {
                Image: transaction.trainingImage,
                ModelDataUrl: trainingResponse.ModelArtifacts.S3ModelArtifacts,
            },
            ExecutionRoleArn: transaction.roleArn,
        };
        try {
            const response = await transaction.sagemaker.createModel(params).promise();
            winston.debug("createModel response", response);
            this.sendCreateModelSuccessEmail(transaction, response).catch(utils_1.logRejection);
        }
        catch (err) {
            this.sendCreateModelFailureEmail(transaction, err).catch(utils_1.logRejection);
        }
    }
}
exports.TrainingJobPoller = TrainingJobPoller;
