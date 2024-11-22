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
exports.Queue = void 0;
const winston = require("winston");
/**
 * Queue
 * helper to run 10 tasks at a time
 *
 * Usage:
 *
 * const queue = new Queue()
 *
 * queue.addTask(async fn)
 * queue.addTask(async fn)
 * queue.addTask(async fn)
 * queue.addTask(async fn)
 * ... add as many tasks as needed
 *
 * const completed = await queue.finish()
 *
 * `completed` is an array of objects with { result } or { error }
 * (the resolved result of each task or the rejected result)
 * the completed results will be in the same order as they were added
 *
 */
class Queue {
    constructor() {
        this.channelSize = 10; // TODO make this configurable?
        this.counter = 0;
        this.queue = [];
        this.channels = [];
        this.completed = [];
        this.finished = false;
        // create our promise which will get returned when the consumer calls queue.finish()
        // stash the resolver so we can use it later
        // is there a better way to do this?
        this.promise = new Promise((resolve) => {
            this.resolve = resolve;
        });
    }
    addTask(run) {
        const task = {
            id: this.counter++,
            run,
        };
        this.queue.push(task);
        this.checkQueue();
    }
    checkQueue() {
        // check if we're finished
        if (this.finished
            && this.queue.length === 0
            && this.channels.length === 0) {
            this.logState();
            // sort completed items by id so they're in the same order as we received them
            this.completed.sort((a, b) => a.id - b.id);
            this.resolve(this.completed);
            return;
        }
        // check if we have any tasks in the queue
        // and room to start a new one
        if (this.queue.length > 0
            && this.channels.length < this.channelSize) {
            // pull a task off the queue
            const task = this.queue.shift();
            if (task) {
                this.startTask(task);
            }
        }
        this.logState();
    }
    logState() {
        winston.debug("- queue:", this.queue.length, "- channels", this.channels.length, "- completed", this.completed.length);
    }
    startTask(task) {
        this.channels.push(task);
        task.run()
            .then((result) => {
            task.result = result;
            this.completeTask(task);
        })
            .catch((error) => {
            task.error = error;
            this.completeTask(task);
        });
    }
    completeTask(task) {
        this.completed.push(task);
        this.channels = this.channels.filter((item) => item !== task);
        this.checkQueue();
    }
    finish() {
        return __awaiter(this, void 0, void 0, function* () {
            this.finished = true;
            return this.promise;
        });
    }
}
exports.Queue = Queue;
