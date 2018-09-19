import * as spawn from "child_process"
import * as winston from "winston"
import {ProcessQueue} from "./process_queue"

export class ExecuteProcessQueue extends ProcessQueue {
    PROCESS_TIMEOUT  = 1000 * 60 * 60 // 1 hour in milliseconds

    processTimeoutKiller(child: spawn.ChildProcess, webhookId: string, cb: any) {
        winston.warn(`Killing ChildProcess for webhookId: ${webhookId}`)
        if (!child.killed) {
            child.kill()
        }
        cb("Killed ChildProcess due to timeout in responding to parent process")
    }

    async run(data: string) {
        return this.queue.add(async () => {
            return new Promise<string>((resolve, reject) => {
                const child = spawn.fork(`./src/xpc/execute_process.ts`)
                const webhookId = JSON.parse(data).webhookId
                winston.info(`ChildProcess created for webhookId: ${webhookId}`)
                let succeeded = false
                const timeout = setTimeout(this.processTimeoutKiller, this.PROCESS_TIMEOUT, child, webhookId, reject)
                child.on("message", (actionResponse) => {
                    clearTimeout(timeout)
                    resolve(actionResponse)
                    winston.info(`ChildProcess was successful for webhookId: ${webhookId}`)
                    succeeded = true
                    child.kill()
                }).on("error", (err) => {
                    clearTimeout(timeout)
                    winston.warn(`ChildProcess sent error message: ${err.message}, for webhookId: ${webhookId}`)
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(err)
                }).on("exit", (code: number, signal: string) => {
                    clearTimeout(timeout)
                    if (!succeeded) {
                        winston.warn(
                            `ChildProcess exited with code: ${code}, signal: ${signal}, for webhookId: ${webhookId}`)
                    }
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(signal)
                }).on("disconnect", () => {
                    clearTimeout(timeout)
                    if (!succeeded) {
                        winston.info(`ChildProcess disconnected, for webhookId: ${webhookId}`)
                    }
                    if (!child.killed) {
                        child.kill()
                    }
                    reject("Child Disconnected")
                }).on("close", (code: number, signal: string) => {
                    clearTimeout(timeout)
                    if (!succeeded) {
                        winston.warn(
                            `ChildProcess closed with code: ${code}, signal: ${signal}, for webhookId: ${webhookId}`)
                    }
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(signal)
                })
                child.send(data)
            })
        })
    }
}
