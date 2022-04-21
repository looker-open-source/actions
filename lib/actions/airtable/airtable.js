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
exports.AirtableAction = void 0;
const Hub = require("../../hub");
const airtable = require("airtable");
class AirtableAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "airtable";
        this.label = "Airtable";
        this.iconName = "airtable/airtable.png";
        this.description = "Add records to an Airtable table.";
        this.params = [
            {
                description: "API key for Airtable from https://airtable.com/account.",
                label: "Airtable API Key",
                name: "airtable_api_key",
                required: true,
                sensitive: true,
            },
        ];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(request.attachment && request.attachment.dataJSON)) {
                throw "No attached json.";
            }
            if (!(request.formParams.base && request.formParams.table)) {
                throw "Missing Airtable base or table.";
            }
            const qr = request.attachment.dataJSON;
            if (!qr.fields || !qr.data) {
                throw "Request payload is an invalid format.";
            }
            const fields = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]));
            const fieldMap = {};
            for (const field of fields) {
                fieldMap[field.name] = field.label_short || field.label || field.name;
            }
            const records = qr.data.map((row) => {
                const record = {};
                for (const field of fields) {
                    record[fieldMap[field.name]] = row[field.name].value;
                }
                return record;
            });
            let response;
            try {
                const airtableClient = this.airtableClientFromRequest(request);
                const base = airtableClient.base(request.formParams.base);
                const table = base(request.formParams.table);
                yield Promise.all(records.map((record) => __awaiter(this, void 0, void 0, function* () {
                    return new Promise((resolve, reject) => {
                        table.create(record, (err, rec) => {
                            if (err) {
                                reject(err);
                            }
                            else {
                                resolve(rec);
                            }
                        });
                    });
                })));
            }
            catch (e) {
                response = { success: false, message: e.message };
            }
            return new Hub.ActionResponse(response);
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "Airtable Base",
                    name: "base",
                    required: true,
                    type: "string",
                }, {
                    label: "Airtable Table",
                    name: "table",
                    required: true,
                    type: "string",
                }];
            return form;
        });
    }
    airtableClientFromRequest(request) {
        return new airtable({ apiKey: request.params.airtable_api_key });
    }
}
exports.AirtableAction = AirtableAction;
Hub.addAction(new AirtableAction());
