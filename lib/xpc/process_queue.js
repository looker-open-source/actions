"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessQueue = void 0;
const Pq = require("p-queue");
class ProcessQueue {
    constructor() {
        // Actions that haven't specified executeInOwnProcess will not
        // be affected by this process count
        const concurrency = process.env.ACTION_HUB_EXECUTE_PROCESS_COUNT ?
            parseInt(process.env.ACTION_HUB_EXECUTE_PROCESS_COUNT, 10) : 1;
        this.queue = new Pq({ concurrency });
    }
}
exports.ProcessQueue = ProcessQueue;
