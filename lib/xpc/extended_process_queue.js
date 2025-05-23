"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtendedProcessQueue = void 0;
const spawn = require("child_process");
const winston = require("winston");
const process_queue_1 = require("./process_queue");
class ExtendedProcessQueue extends process_queue_1.ProcessQueue {
    constructor() {
        super(...arguments);
        this.PROCESS_TIMEOUT = 1000 * 60 * 120; // 2 hours in milliseconds
        this.DONE_MESSAGE = "PROCESS FINISHED";
        this.MAX_EXTENDED_CHILD_CONCURRENCY = 2;
        this.childCounter = 0;
    }
    processTimeoutKiller(child, webhookId, lookerReponseCallback, processCallback) {
        const msg = "Killed execute process due to timeout in responding to parent process";
        winston.warn(msg, { webhookId });
        if (!child.killed) {
            child.kill();
        }
        lookerReponseCallback(msg);
        processCallback();
    }
    async child_runner(child, data, webhookId, lookerResponseResolve, lookerResponseReject) {
        return new Promise((processResolve, processReject) => {
            const timeout = setTimeout(this.processTimeoutKiller, this.PROCESS_TIMEOUT, child, webhookId, lookerResponseReject, processReject);
            let succeeded = false;
            child.on("message", (response) => {
                if (response !== this.DONE_MESSAGE) {
                    lookerResponseResolve(response);
                    winston.info(`execute process returning successful response to Looker`, { webhookId });
                }
                else {
                    winston.info(`execute process finished successfully`, { webhookId });
                    succeeded = true;
                    clearTimeout(timeout);
                    child.kill();
                    processResolve();
                }
            }).on("error", (err) => {
                clearTimeout(timeout);
                winston.warn(`execute process sent error message`, { webhookId, message: err.message });
                if (!child.killed) {
                    child.kill();
                }
                lookerResponseReject(err);
                processReject();
            }).on("exit", (code, signal) => {
                clearTimeout(timeout);
                if (!succeeded) {
                    winston.warn(`execute process exited`, { webhookId, code, signal });
                }
                if (!child.killed) {
                    child.kill();
                }
                lookerResponseReject(signal);
                processReject();
            }).on("disconnect", () => {
                clearTimeout(timeout);
                if (!succeeded) {
                    winston.info(`execute process disconnected`, { webhookId });
                }
                if (!child.killed) {
                    child.kill();
                }
                lookerResponseReject("Child Disconnected");
                processReject();
            }).on("close", (code, signal) => {
                clearTimeout(timeout);
                if (!succeeded) {
                    winston.warn(`execute process closed`, { webhookId, code, signal });
                }
                if (!child.killed) {
                    child.kill();
                }
                lookerResponseReject(signal);
                processReject();
            });
            child.send(data);
        });
    }
    async run(data) {
        return this.queue.add(async () => {
            while (this.childCounter >= this.MAX_EXTENDED_CHILD_CONCURRENCY) {
                await new Promise((resolve) => {
                    setTimeout(resolve, 1000 * 10);
                });
            }
            this.childCounter += 1;
            return new Promise((resolve, reject) => {
                const child = spawn.fork(`./src/xpc/execute_process.ts`);
                const webhookId = JSON.parse(data).webhookId;
                winston.info(`execute process created`, { webhookId });
                this.child_runner(child, data, webhookId, resolve, reject).then(() => {
                    this.childCounter -= 1;
                }).catch(() => {
                    this.childCounter -= 1;
                });
            });
        });
    }
}
exports.ExtendedProcessQueue = ExtendedProcessQueue;
