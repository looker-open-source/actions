"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Poller = void 0;
/* tslint:disable max-line-length */
const winston = require("winston");
class Poller {
    constructor(transaction) {
        this.pollTrainingJob(transaction).catch(this.logRejection);
    }
    pollTrainingJob(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            // start poller for training job completion
            winston.debug("starting poller");
            this.intervalTimer = setInterval(() => {
                this.checkStatus(transaction).catch(this.logRejection);
            }, 10 * 1000);
            this.timeoutTimer = setTimeout(() => {
                clearInterval(this.intervalTimer);
                this.logRejection;
            }, 360 * 1000);
        });
    }
    checkStatus(transaction) {
        return __awaiter(this, void 0, void 0, function* () {
            winston.debug("polling training job status");
            if (!transaction.pollFunction) {
                throw new Error("pollFunction or callback not defined");
            }
            const response = yield transaction.pollFunction(transaction);
            const status = response.body.data.status || response.body.data.search_space_status;
            winston.debug("response status", status);
            switch (status) {
                case transaction.successStatus:
                    winston.debug("polling running");
                    this.stopPolling();
                    if (transaction.callbackFunction !== undefined) {
                        yield transaction.callbackFunction(transaction);
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
        });
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
