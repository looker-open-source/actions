import * as spawn from "child_process"
import * as express from "express"
import * as winston from "winston"
import {ProcessQueue} from "./process_queue"

export class AsyncProcessJob extends ProcessQueue {

    async run(req: express.Request, res: express.Response) {
        return this.queue.add(async () => {
            return new Promise<void>((resolve, reject) => {
                const child = spawn.fork(`./src/actions/actions_process.ts`)
                child.on("message", (actionResponse) => {
                    // Some versions of Looker do not look at the "success" value in the response
                    // if the action returns a 200 status code, even though the Action API specs otherwise.
                    // So we force a non-200 status code as a workaround.
                    winston.info("Success? " + actionResponse.success
                        + " || and what: " + JSON.stringify(actionResponse))
                    if (!actionResponse.success) {
                        res.status(400)
                    }
                    res.json(actionResponse)

                    child.kill()
                    resolve()
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
                const data = {
                    body: req.body,
                    actionId: req.params.actionId,
                    instanceId: req.header("x-looker-instance"),
                    webhookId: req.header("x-looker-webhook-id"),
                    userAgent: req.header("user-agent"),
                }
                child.send(data)
            })
        })
    }
}
