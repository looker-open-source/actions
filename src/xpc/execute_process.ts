import * as dotenv from "dotenv"
import * as winston from "winston"

import { registerDebugAction } from "../actions/debug/debug"
import "../actions/index.ts"
import * as Hub from "../hub/index"

dotenv.config()
registerDebugAction()

async function execute(jsonPayload: any) {
    const req = JSON.parse(jsonPayload)
    const request = Hub.ActionRequest.fromIPC(req)
    const action = await Hub.findAction(req.actionId, {lookerVersion: req.lookerVersion})
    return action.execute(request)
}

process.on("message", (req) => {
    execute(req)
        .then((val) => { process.send!(val)})
        .catch((err) => {
            let errorString
            if (err instanceof Error) {
                errorString = err.message || err.toString()
                if (errorString === "{}") {
                    winston.debug("err.message resolved into {}");
                }
            } else if (typeof err === "object" && err !== null) {
                try {
                    if (Object.prototype.hasOwnProperty.call(err, 'message') && typeof (err as any).message === 'string') {
                        errorString = (err as any).message;
                    } else {
                        const stringified = JSON.stringify(err);
                        if (stringified === "{}" || stringified === "[]") {
                            winston.debug("Error stringified into {}");
                            errorString = err.toString();
                        } else {
                            errorString = stringified;
                        }
                    }
                } catch (jsonError: any) {
                    errorString = `[Object could not be stringified: ${jsonError.message || jsonError.toString()}]`
                }
            } else {
                errorString = String(err)
                if (errorString === "{}") {
                    winston.debug("String(err) resolved into {}");
                }
            }
            const request = Hub.ActionRequest.fromIPC(req)
            winston.error(`Error on child: ${errorString}. WebhookID: ${request.webhookId}`)
            process.send!({success: false, message: errorString})
        })
})