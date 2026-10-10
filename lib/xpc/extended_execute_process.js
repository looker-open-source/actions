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
    const action = await Hub.findExtendedAction(req.actionId, { lookerVersion: req.lookerVersion });
    if (action === null) {
        throw "action is not extended";
    }
    return action.execute(request);
}
process.on("message", (req) => {
    execute(req)
        .then((val) => { process.send(val); })
        .catch((err) => {
        let errorString;
        if (err instanceof Error) {
            errorString = err.message || err.toString();
            if (errorString === "{}") {
                winston.debug("err.message or err.toString() for Error instance resulted in '{}'. Using a more descriptive fallback.");
                errorString = "Unnamed Error";
            }
        }
        else if (typeof err === "object" && err !== null) {
            try {
                if (Object.prototype.hasOwnProperty.call(err, "message") && typeof (err).message === "string") {
                    errorString = (err).message;
                }
                else {
                    const stringified = JSON.stringify(err);
                    if (stringified === "{}" || stringified === "[]") {
                        winston.debug("Error stringified into {}");
                        errorString = err.toString();
                    }
                    else {
                        errorString = stringified;
                    }
                }
            }
            catch (jsonError) {
                errorString = `[Object could not be stringified: ${jsonError.message || jsonError.toString()}]`;
            }
        }
        else {
            errorString = String(err);
            if (errorString === "{}") {
                winston.debug("String(err) resulted in '{}'. Using a generic representation for non-object error.");
                errorString = "Unnamed Error";
            }
        }
        const request = Hub.ActionRequest.fromIPC(req);
        winston.error(`Received Error on child in extended queue: ${errorString}. WebhookID: ${request.webhookId}`);
        process.send({ success: false, message: errorString });
    });
});
