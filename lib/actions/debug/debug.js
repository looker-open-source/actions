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
exports.DebugAction = exports.registerDebugAction = void 0;
const winston = require("winston");
const Hub = require("../../hub");
function registerDebugAction() {
    if (process.env.ACTION_HUB_DEBUG_ENDPOINT) {
        Hub.addAction(new DebugAction());
    }
}
exports.registerDebugAction = registerDebugAction;
class DebugAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "debug";
        this.label = "Debug";
        this.description = "Sends data to a sample website and optionally sleeps.";
        this.supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Dashboard, Hub.ActionType.Query];
        this.supportedFormats = [];
        this.params = [];
        this.executeInOwnProcess = false;
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const activities = [];
            function doActivity(activity) {
                winston.info(`[debug action] Doing ${activity}...`);
                activities.push(activity);
            }
            // Delay if needed
            const sleep = +(request.formParams.sleep ? request.formParams.sleep : 1000);
            if (sleep > 0) {
                doActivity(`sleep ${sleep} ms...`);
                yield this.delay(sleep);
            }
            return new Hub.ActionResponse({ message: `Completed debug action successfully by doing ${activities.join(", ")}.` });
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Sleep",
                    name: "sleep",
                    required: false,
                    type: "string",
                },
                {
                    label: "Simulated Download URL (JSON)",
                    name: "simulated_download_url",
                    required: false,
                    type: "string",
                }];
            return form;
        });
    }
    delay(t) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => {
                setTimeout(resolve, t);
            });
        });
    }
}
exports.DebugAction = DebugAction;
