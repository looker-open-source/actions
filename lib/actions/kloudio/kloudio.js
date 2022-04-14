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
exports.KloudioAction = void 0;
const https = require("request-promise-native");
const uuid = require("uuid");
const winston = require("winston");
const Hub = require("../../hub");
const s3Bool = true;
let data = {};
class KloudioAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "kloudio";
        this.label = "Kloudio";
        this.iconName = "kloudio/kloudio.svg";
        this.description = "Add data to Google sheets.";
        this.params = [];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.JsonDetail];
        this.supportedFormattings = [Hub.ActionFormatting.Unformatted];
        this.supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply];
        this.signedUrl = process.env.KLOUDIO_SIGNED_URL;
        this.API_URL = process.env.KLOUDIO_API_URL;
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(request.attachment && request.attachment.dataJSON)) {
                throw "No attached json.";
            }
            if (!(request.formParams.apiKey)) {
                throw "Missing API key";
            }
            if (!(request.formParams.url)) {
                throw "Missing Google sheets URL";
            }
            const qr = request.attachment.dataJSON;
            if (!qr.fields || !qr.data) {
                throw "Request payload is an invalid format.";
            }
            winston.debug(typeof request.attachment.dataJSON);
            const { spreadsheetId, sheetId } = yield parseGsheet(request.formParams.url);
            const labels = request.attachment.dataJSON.fields.dimensions.map((label) => label.label);
            const finalLabels = [];
            finalLabels.push(labels);
            const names = request.attachment.dataJSON.fields.dimensions.map((labelId) => labelId.name);
            const dataRows = yield parseData(request.attachment.dataJSON.data, names, finalLabels);
            let response;
            const anonymousId = this.generateAnonymousId() + ".json";
            const s3SignedUrl = yield getS3Url(anonymousId, this.signedUrl, request.formParams.apiKey);
            if (!s3SignedUrl.signedURL || s3SignedUrl.success === false) {
                const resp = JSON.parse(s3SignedUrl.message);
                response = { success: false, message: resp.error };
                return new Hub.ActionResponse(response);
            }
            yield uploadToS32(s3SignedUrl.signedURL, dataRows);
            data = { destination: "looker", apiKey: request.formParams.apiKey, spreadsheetId, sheetId,
                s3Upload: s3Bool, data: anonymousId, reportName: "Looker Report" };
            try {
                const newUri = this.API_URL.replace(/['"]+/g, "");
                const lambdaResponse = yield https.post({
                    url: newUri,
                    headers: { "Content-Type": "application/json" },
                    json: true,
                    body: data,
                }).catch((_err) => {
                    const error = JSON.parse(_err);
                    winston.error("parsing error code" + error.emailCode);
                    winston.error(_err.toString());
                });
                if (!lambdaResponse.success || lambdaResponse.success === false) {
                    winston.info("lambda url resp is not sucess " + lambdaResponse);
                    response = { success: false, message: lambdaResponse.message };
                }
                else {
                    response = { success: true, message: lambdaResponse.message };
                }
            }
            catch (e) {
                winston.error("Inside catch statement" + e);
                response = { success: false, message: e.message };
            }
            return new Hub.ActionResponse(response);
        });
    }
    form() {
        return __awaiter(this, void 0, void 0, function* () {
            const form = new Hub.ActionForm();
            form.fields = [{
                    label: "API Key",
                    name: "apiKey",
                    required: true,
                    type: "string",
                }, {
                    label: "Google Sheets URL",
                    name: "url",
                    required: true,
                    type: "string",
                }];
            return form;
        });
    }
    generateAnonymousId() {
        return uuid.v4();
    }
}
exports.KloudioAction = KloudioAction;
function parseData(lookerData, names, labels) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                for (const row of lookerData) {
                    const tempA = [];
                    for (const label of names) {
                        if (row[label].rendered) {
                            tempA.push(row[label].rendered);
                        }
                        else {
                            tempA.push(row[label].value);
                        }
                    }
                    labels.push(tempA);
                }
                return resolve(labels);
            }
            catch (error) {
                return reject(error);
            }
        }));
    });
}
function getS3Url(fileName, url, token) {
    return __awaiter(this, void 0, void 0, function* () {
        let errsResponse = { success: true, message: "success" };
        const comurl = url + fileName + "&apiKey=" + token;
        const apiURL = comurl.replace(/['"]+/g, "");
        const s3UrlResponse = yield https.get({
            url: apiURL,
            headers: { ContentType: "application/json" },
        }).catch((_err) => {
            errsResponse = { success: false, message: _err.error };
            winston.error(_err.toString());
        });
        if (errsResponse.success === false || !errsResponse.success) {
            return errsResponse;
        }
        else {
            return JSON.parse(s3UrlResponse);
        }
    });
}
function uploadToS32(url, s3Data1) {
    return __awaiter(this, void 0, void 0, function* () {
        const santUrl = url.replace(/['"]+/g, "");
        const response = https.put({
            url: santUrl,
            headers: { "Content-Type": "application/json" },
            json: true,
            body: s3Data1,
        }).catch((err) => { winston.error(err.toString()); });
        return response;
    });
}
function parseGsheet(gsheet) {
    return __awaiter(this, void 0, void 0, function* () {
        const urlRegex = /(https:\/\/docs.google.com\/spreadsheets\/d\/[a-zA-Z0-9_-]*\/edit#gid=[0-9]*)/g;
        if (!urlRegex.test(gsheet)) {
            throw new Error("Invalid url");
        }
        const slashArray = gsheet.split("/");
        const spreadsheetId = slashArray[5];
        const assignmentArray = slashArray[6].split("=");
        const sheetId = assignmentArray[1];
        return { spreadsheetId, sheetId };
    });
}
Hub.addAction(new KloudioAction());
