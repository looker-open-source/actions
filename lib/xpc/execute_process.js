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
        const stringErr = JSON.stringify(err);
        winston.error("Error on child: " + stringErr);
        process.send({ success: false, message: stringErr });
    });
});
