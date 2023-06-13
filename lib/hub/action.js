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
exports.Action = void 0;
const fs = require("fs");
const path = require("path");
const winston = require("winston");
const _1 = require(".");
const datauri = require("datauri");
class Action {
    constructor() {
        this.usesStreaming = false;
        this.executeInOwnProcess = false;
        this.extendedAction = false;
        // Default to the earliest version of Looker with support for the Action API
        this.minimumSupportedLookerVersion = "5.5.0";
        this.requiredFields = [];
    }
    get hasForm() {
        return !!this.form;
    }
    asJson(router, request) {
        return {
            description: this.description,
            form_url: this.form ? router.formUrl(this) : null,
            label: this.label,
            name: this.name,
            params: this.params,
            required_fields: this.requiredFields,
            supported_action_types: this.supportedActionTypes,
            uses_oauth: false,
            delegate_oauth: false,
            supported_formats: (this.supportedFormats instanceof Function)
                ? this.supportedFormats(request) : this.supportedFormats,
            supported_formattings: this.supportedFormattings,
            supported_visualization_formattings: this.supportedVisualizationFormattings,
            supported_download_settings: (this.usesStreaming
                ?
                    [_1.ActionDownloadSettings.Url]
                :
                    [_1.ActionDownloadSettings.Push]),
            icon_data_uri: this.getImageDataUri(),
            url: router.actionUrl(this),
        };
    }
    validateAndExecute(request, queue) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.supportedActionTypes.indexOf(request.type) === -1) {
                const types = this.supportedActionTypes.map((at) => `"${at}"`).join(", ");
                if (request.type) {
                    throw `This action does not support requests of type "${request.type}". The request must be of type: ${types}.`;
                }
                else {
                    throw `No request type specified. The request must be of type: ${types}.`;
                }
            }
            this.throwForMissingRequiredParameters(request);
            if (this.usesStreaming &&
                !(request.attachment || (request.scheduledPlan && request.scheduledPlan.downloadUrl))) {
                throw "A streaming action was sent incompatible data. The action must have a download url or an attachment.";
            }
            // Forking is on by default but can be disabled by setting ACTION_HUB_ENABLE_FORKING=false
            const executeInOwnProcessEnabled = process.env.ACTION_HUB_ENABLE_FORKING !== "false";
            if (this.executeInOwnProcess && executeInOwnProcessEnabled) {
                if (!queue) {
                    throw "An action marked for being executed on a separate process needs a ExecuteProcessQueue.";
                }
                request.actionId = this.name;
                winston.info(`Execute Action Enqueued. Queue length: ${queue.queue.size}`, { webhookId: request.webhookId });
                return new Promise((resolve, reject) => {
                    queue.run(JSON.stringify(request)).then((response) => {
                        const actionResponse = new _1.ActionResponse();
                        Object.assign(actionResponse, response);
                        resolve(actionResponse);
                    }).catch((err) => {
                        winston.error(`${JSON.stringify(err)}`, { webhookId: request.webhookId });
                        const response = new _1.ActionResponse();
                        response.success = false;
                        response.message = JSON.stringify(err);
                        reject(response);
                    });
                });
            }
            else {
                return this.execute(request);
            }
        });
    }
    validateAndFetchForm(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.throwForMissingRequiredParameters(request);
            }
            catch (e) {
                const errorForm = new _1.ActionForm();
                errorForm.error = e;
                return errorForm;
            }
            return this.form(request);
        });
    }
    getImageDataUri() {
        if (!this.iconName) {
            return null;
        }
        const iconPath = path.resolve(__dirname, "..", "actions", this.iconName);
        if (fs.existsSync(iconPath)) {
            return new datauri(iconPath).content;
        }
        return null;
    }
    throwForMissingRequiredParameters(request) {
        const requiredParams = this.params.filter((p) => p.required);
        if (requiredParams.length > 0) {
            for (const p of requiredParams) {
                const param = request.params[p.name];
                if (!param) {
                    throw `Required setting "${p.label}" not specified in action settings.`;
                }
            }
        }
    }
}
exports.Action = Action;
