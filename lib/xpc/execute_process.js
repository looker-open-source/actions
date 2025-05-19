"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const winston = require("winston");
const debug_1 = require("../actions/debug/debug");
require("../actions/index.ts");
const Hub = require("../hub/index");
dotenv.config();
(0, debug_1.registerDebugAction)();
async function execute(jsonPayload) {
    const req = JSON.parse(jsonPayload);
    const request = Hub.ActionRequest.fromIPC(req);
    const action = await Hub.findAction(req.actionId, { lookerVersion: req.lookerVersion });
    return action.execute(request);
}
process.on("message", (req) => {
    execute(req)
        .then((val) => { process.send(val); })
        .catch((err) => {
        let errorString;
        if (err instanceof Error) {
            errorString = err.message || err.toString();
        }
        else if (typeof err === "object" && err !== null) {
            try {
                errorString = JSON.stringify(err);
            }
            catch (jsonError) {
                errorString = `[Object could not be stringified: ${jsonError.message || jsonError.toString()}]`;
            }
        }
        else {
            errorString = String(err);
        }
        const request = Hub.ActionRequest.fromIPC(req);
        winston.error(`Error on child: ${errorString}. WebhookID: ${request.webhookId}`);
        process.send({ success: false, message: errorString });
    });
});
