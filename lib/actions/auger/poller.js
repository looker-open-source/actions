"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Poller = void 0;
/* tslint:disable max-line-length */
const winston = require("winston");
class Poller {
    constructor(transaction) {
        this.pollTrainingJob(transaction).catch(this.logRejection);
    }
    async pollTrainingJob(transaction) {
        // start poller for training job completion
        winston.debug("starting poller");
        this.intervalTimer = setInterval(() => {
            this.checkStatus(transaction).catch(this.logRejection);
        }, 10 * 1000);
        this.timeoutTimer = setTimeout(() => {
            clearInterval(this.intervalTimer);
            this.logRejection;
        }, 360 * 1000);
    }
    async checkStatus(transaction) {
        winston.debug("polling training job status");
        if (!transaction.pollFunction) {
            throw new Error("pollFunction or callback not defined");
        }
        const response = await transaction.pollFunction(transaction);
        const status = response.body.data.status || response.body.data.search_space_status;
        winston.debug("response status", status);
        switch (status) {
            case transaction.successStatus:
                winston.debug("polling running");
                this.stopPolling();
                if (transaction.callbackFunction !== undefined) {
                    await transaction.callbackFunction(transaction);
                }
                else {
                    if (process.send) {
                        process.send("PROCESS FINISHED");
                    }
                }
                break;
            case transaction.errorStatus:
                winston.debug("polling undeployed");
                this.stopPolling();
                if (process.send) {
                    process.send("PROCESS FINISHED");
                }
                break;
        }
    }
    stopPolling() {
        winston.debug("stopping poller");
        clearInterval(this.intervalTimer);
        clearTimeout(this.timeoutTimer);
    }
    logRejection(err) {
        winston.debug(err);
    }
}
exports.Poller = Poller;
