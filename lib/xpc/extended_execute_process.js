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
const dotenv = require("dotenv");
const winston = require("winston");
const debug_1 = require("../actions/debug/debug");
require("../actions/index.ts");
const Hub = require("../hub/index");
dotenv.config();
(0, debug_1.registerDebugAction)();
function execute(jsonPayload) {
    return __awaiter(this, void 0, void 0, function* () {
        const req = JSON.parse(jsonPayload);
        const request = Hub.ActionRequest.fromIPC(req);
        const action = yield Hub.findExtendedAction(req.actionId, { lookerVersion: req.lookerVersion });
        if (action === null) {
            throw "action is not extended";
        }
        return action.execute(request);
    });
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
