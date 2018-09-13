import * as spawn from "child_process"
import * as winston from "winston"
import {ProcessQueue} from "./process_queue"

export class ExecuteProcessQueue extends ProcessQueue {

    async run(data: string) {
        return this.queue.add(async () => {
            return new Promise<string>((resolve, reject) => {
                const child = spawn.fork(`./src/xpc/execute_process.ts`)
                child.on("message", (actionResponse) => {
                    resolve(actionResponse)
                    child.kill()
                }).on("error", (err) => {
                    winston.warn(`ChildProcess sent error message: ${err.message}`)
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(err)
                }).on("exit", (code: number, signal: string) => {
                    winston.info(`ChildProcess exited with code: ${code}, signal: ${signal}`)
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(signal)
                }).on("disconnect", () => {
                    winston.warn(`ChildProcess disconnected`)
                    if (!child.killed) {
                        child.kill()
                    }
                    reject("Child Disconnected")
                }).on("close", (code: number, signal: string) => {
                    if (signal !== "SIGTERM") {
                        winston.warn(`ChildProcess closed with code: ${code}, signal: ${signal}`)
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
