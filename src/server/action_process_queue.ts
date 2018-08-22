import * as spawn from "child_process"
import * as winston from "winston"
import {ProcessQueue} from "./process_queue"

export class AsyncProcessJob extends ProcessQueue {

    async run(data: string) {
        return this.queue.add(async () => {
            return new Promise<string>((resolve, reject) => {
                const child = spawn.fork(`./src/actions/actions_process.ts`)
                child.on("message", (actionResponse) => {
                    child.kill()
                    resolve(actionResponse)
                }).on("error", (err) => {
                    winston.warn(err.message)
                    if (!child.killed) {
                        child.kill()
                    }
                    reject(err)
                }).on("exit", () => {
                    if (!child.killed) {
                        child.kill()
                    }
                })
                child.send(data)
            })
        })
    }
}
