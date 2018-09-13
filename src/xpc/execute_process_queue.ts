import * as spawn from "child_process"
import * as winston from "winston"
import {ProcessQueue} from "./process_queue"

export class ExecuteProcessQueue extends ProcessQueue {

    async run(data: string) {
        return this.queue.add(async () => {
            return new Promise<string>((resolve, reject) => {
                const child = spawn.fork(`./src/xpc/execute_process.ts`)
                const webhookId = JSON.parse(data).webhookId
                winston.info(`ChildProcess created for webhookId: ${webhookId}`)
                let succeeded = false
                child.on("message", (actionResponse) => {
                    resolve(actionResponse)
                    winston.info(`ChildProcess was successful for webhookId: ${webhookId}`)
                    succeeded = true
                    child.kill()
                }).on("error", (err) => {
                    winston.warn(`ChildProcess sent error message: ${err.message}, for webhookId: ${webhookId}`)
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(err)
                }).on("exit", (code: number, signal: string) => {
                    if (!succeeded) {
                        winston.warn(
                            `ChildProcess exited with code: ${code}, signal: ${signal}, for webhookId: ${webhookId}`)
                    }
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(signal)
                }).on("disconnect", () => {
                    if (!succeeded) {
                        winston.info(`ChildProcess disconnected, for webhookId: ${webhookId}`)
                    }
                    if (!child.killed) {
                        child.kill()
                    }
                    reject("Child Disconnected")
                }).on("close", (code: number, signal: string) => {
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
