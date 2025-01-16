"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugAction = void 0;
exports.registerDebugAction = registerDebugAction;
const winston = require("winston");
const Hub = require("../../hub");
function registerDebugAction() {
    if (process.env.ACTION_HUB_DEBUG_ENDPOINT) {
        Hub.addAction(new DebugAction());
    }
}
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
    async execute(request) {
        const activities = [];
        function doActivity(activity) {
            winston.info(`[debug action] Doing ${activity}...`);
            activities.push(activity);
        }
        // Delay if needed
        const sleep = +(request.formParams.sleep ? request.formParams.sleep : 1000);
        if (sleep > 0) {
            doActivity(`sleep ${sleep} ms...`);
            await this.delay(sleep);
        }
        return new Hub.ActionResponse({ message: `Completed debug action successfully by doing ${activities.join(", ")}.` });
    }
    async form() {
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
    }
    async delay(t) {
        return new Promise((resolve) => {
            setTimeout(resolve, t);
        });
    }
}
exports.DebugAction = DebugAction;
