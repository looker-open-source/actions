"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const datauri = require("datauri");
class Integration {
    constructor() {
        this.requiredFields = [];
    }
    asJson(router) {
        return {
            description: this.description,
            form_url: this.form ? router.formUrl(this) : null,
            label: this.label,
            name: this.name,
            params: this.params,
            required_fields: this.requiredFields,
            supported_action_types: this.supportedActionTypes,
            supported_formats: this.supportedFormats,
            supported_formattings: this.supportedFormattings,
            supported_visualization_formattings: this.supportedVisualizationFormattings,
            icon_data_uri: this.getImageDataUri(),
            url: this.action ? router.actionUrl(this) : null,
        };
    }
    validateAndPerformAction(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.supportedActionTypes &&
                this.supportedActionTypes.indexOf(request.type) === -1) {
                throw `This action does not support requests of type "${request.type}".`;
            }
            const requiredParams = this.params.filter((p) => p.required);
            if (requiredParams.length > 0) {
                if (request.params) {
                    for (const p of requiredParams) {
                        const param = request.params[p.name];
                        if (!param) {
                            throw `Required parameter "${p.name}" not provided.`;
                        }
                    }
                }
                else {
                    throw `No "params" provided but this action has required parameters.`;
                }
            }
            return this.action(request);
        });
    }
    validateAndFetchForm(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.form(request);
        });
    }
    get hasAction() {
        return !!this.action;
    }
    get hasForm() {
        return !!this.form;
    }
    getImageDataUri() {
        if (!this.iconName) {
            return null;
        }
        const iconPath = path.resolve(__dirname, "..", "integrations", this.iconName);
        if (fs.existsSync(iconPath)) {
            return new datauri(iconPath).content;
        }
        return null;
    }
}
exports.Integration = Integration;
