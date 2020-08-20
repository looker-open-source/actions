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
exports.GoogleSheetsAction = void 0;
const Hub = require("../../../../hub");
const async_mutex_1 = require("async-mutex");
const parse = require("csv-parse");
const googleapis_1 = require("googleapis");
const winston = require("winston");
const google_drive_1 = require("../google_drive");
const MAX_REQUEST_BATCH = 500;
const MAX_ROW_BUFFER_INCREASE = 2000;
class GoogleSheetsAction extends google_drive_1.GoogleDriveAction {
    constructor() {
        super(...arguments);
        this.name = "google_sheets";
        this.label = "Google Sheets";
        this.iconName = "google/drive/sheets/sheets.svg";
        this.description = "Create a new Google Sheet.";
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.supportedFormats = [Hub.ActionFormat.Csv];
        this.executeInOwnProcess = true;
        this.mimeType = "application/vnd.google-apps.spreadsheet";
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = new Hub.ActionResponse();
            if (!request.params.state_json) {
                resp.success = false;
                resp.state = new Hub.ActionState();
                resp.state.data = "reset";
                return resp;
            }
            const stateJson = JSON.parse(request.params.state_json);
            if (stateJson.tokens && stateJson.redirect) {
                const drive = yield this.driveClientFromRequest(stateJson.redirect, stateJson.tokens);
                let filename = request.formParams.filename || request.suggestedFilename();
                if (!filename) {
                    resp.success = false;
                    resp.message = "Error creating filename";
                    return resp;
                }
                else if (!filename.match(/\.csv$/)) {
                    filename = filename.concat(".csv");
                }
                try {
                    if (request.formParams.overwrite === "yes") {
                        const sheet = yield this.sheetsClientFromRequest(stateJson.redirect, stateJson.tokens);
                        yield this.sendOverwriteData(filename, request, drive, sheet);
                        resp.success = true;
                    }
                    else {
                        yield this.sendData(filename, request, drive);
                        resp.success = true;
                    }
                }
                catch (e) {
                    resp.success = false;
                    resp.message = e.message;
                }
            }
            else {
                resp.success = false;
                resp.state = new Hub.ActionState();
                resp.state.data = "reset";
            }
            return resp;
        });
    }
    form(request) {
        const _super = Object.create(null, {
            form: { get: () => super.form }
        });
        return __awaiter(this, void 0, void 0, function* () {
            const form = yield _super.form.call(this, request);
            if (form.fields[0].type !== "oauth_link_google") {
                form.fields.push({
                    description: "Should this action attempt to overwrite an existing file",
                    label: "Overwrite Existing Files",
                    name: "overwrite",
                    options: [{ name: "yes", label: "Yes" }, { name: "no", label: "No" }],
                    default: "yes",
                    required: true,
                    type: "select",
                });
            }
            return form;
        });
    }
    oauthUrl(redirectUri, encryptedState) {
        return __awaiter(this, void 0, void 0, function* () {
            const oauth2Client = this.oauth2Client(redirectUri);
            // generate a url that asks permissions for Google Drive scope
            const scopes = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ];
            const url = oauth2Client.generateAuthUrl({
                access_type: "offline",
                scope: scopes,
                prompt: "consent",
                state: encryptedState,
            });
            return url.toString();
        });
    }
    sendOverwriteData(filename, request, drive, sheet) {
        return __awaiter(this, void 0, void 0, function* () {
            const mutex = new async_mutex_1.Mutex();
            const parents = request.formParams.folder ? [request.formParams.folder] : undefined;
            const options = {
                q: `name = '${filename}' and '${parents}' in parents and trashed=false`,
                fields: "files",
            };
            if (request.formParams.drive !== undefined && request.formParams.drive !== "mydrive") {
                options.driveId = request.formParams.drive;
                options.includeItemsFromAllDrives = true;
                options.supportsAllDrives = true;
                options.corpora = "drive";
            }
            else {
                options.corpora = "user";
            }
            const files = yield drive.files.list(options);
            if (files.data.files === undefined || files.data.files.length === 0) {
                winston.info(`New file: ${filename}`);
                return this.sendData(filename, request, drive);
            }
            if (files.data.files[0].id === undefined) {
                throw "No spreadsheet ID";
            }
            const spreadsheetId = files.data.files[0].id;
            const sheets = yield sheet.spreadsheets.get({ spreadsheetId });
            if (!sheets.data.sheets || sheets.data.sheets[0].properties === undefined) {
                throw "Now sheet data available";
            }
            // The ignore is here because Typescript is not correctly inferring that I have done existence checks
            // @ts-ignore
            const sheetId = sheets.data.sheets[0].properties.sheetId;
            // @ts-ignore
            let maxRows = sheets.data.sheets[0].properties.gridProperties.rowCount;
            const requestBody = { requests: [] };
            let rowCount = 0;
            let finished = false;
            return request.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    const csvparser = parse();
                    // This will not clear formulas or protected regions
                    yield this.clearSheet(spreadsheetId, sheet);
                    csvparser.on("data", (line) => __awaiter(this, void 0, void 0, function* () {
                        const rowIndex = rowCount++;
                        // Sanitize line data and properly encapsulate string formatting for CSV lines
                        const lineData = line.map((record) => {
                            record = record.replace(/\"/g, "\"\"");
                            return `"${record}"`;
                        }).join(",");
                        // @ts-ignore
                        requestBody.requests.push({
                            pasteData: {
                                coordinate: {
                                    sheetId,
                                    columnIndex: 0,
                                    rowIndex,
                                },
                                data: lineData,
                                delimiter: ",",
                                type: "PASTE_NORMAL",
                            },
                        });
                        // @ts-ignore
                        if (requestBody.requests.length > MAX_REQUEST_BATCH) {
                            yield mutex.runExclusive(() => __awaiter(this, void 0, void 0, function* () {
                                // @ts-ignore
                                if (requestBody.requests.length > MAX_REQUEST_BATCH) {
                                    const requestCopy = {};
                                    // Make sure to do a deep copy of the request
                                    Object.assign(requestCopy, requestBody);
                                    requestBody.requests = [];
                                    if (rowCount >= maxRows) {
                                        // Make sure we grow at least by requestlength.
                                        // Add MAX_ROW_BUFFER_INCREASE in addition to give headroom for more requests before
                                        // having to resize again
                                        const requestLen = requestCopy.requests ? requestCopy.requests.length : 0;
                                        winston.info(`Expanding max rows: ${maxRows} to ` +
                                            `${maxRows + requestLen + MAX_ROW_BUFFER_INCREASE}`, request.webhookId);
                                        maxRows = maxRows + requestLen + MAX_ROW_BUFFER_INCREASE;
                                        // @ts-ignore
                                        yield sheet.spreadsheets.batchUpdate({
                                            spreadsheetId,
                                            requestBody: {
                                                requests: [{
                                                        updateSheetProperties: {
                                                            properties: {
                                                                sheetId,
                                                                gridProperties: {
                                                                    rowCount: maxRows,
                                                                },
                                                            },
                                                            fields: "gridProperties(rowCount)",
                                                        },
                                                    }],
                                            },
                                        }).catch((e) => {
                                            reject(e);
                                        });
                                    }
                                    yield this.flush(requestCopy, sheet, spreadsheetId).catch((e) => {
                                        winston.error(e);
                                        reject(e);
                                    });
                                }
                            })).catch((e) => {
                                reject(e);
                            });
                        }
                    })).on("end", () => __awaiter(this, void 0, void 0, function* () {
                        finished = true;
                        yield mutex.runExclusive(() => __awaiter(this, void 0, void 0, function* () {
                            // @ts-ignore
                            if (requestBody.requests.length > 0) {
                                yield this.flush(requestBody, sheet, spreadsheetId).catch((e) => {
                                    reject(e);
                                });
                            }
                            winston.info(`Google Sheets Streamed ${rowCount} rows including headers`);
                            resolve();
                        })).catch((e) => {
                            reject(e);
                        });
                    })).on("error", (e) => {
                        winston.error(e);
                        reject(e);
                    }).on("close", () => {
                        if (!finished) {
                            winston.warn(`Google Sheets Streaming closed socket before "end" event stream.`);
                            reject(`"end" event not called before finishing stream`);
                        }
                    });
                    readable.pipe(csvparser);
                }));
            }));
        });
    }
    clearSheet(spreadsheetId, sheet) {
        return __awaiter(this, void 0, void 0, function* () {
            return sheet.spreadsheets.values.clear({
                spreadsheetId,
                range: "A:XX",
            }).catch((err) => {
                winston.error(err);
                throw err;
            });
        });
    }
    flush(buffer, sheet, spreadsheetId) {
        return __awaiter(this, void 0, void 0, function* () {
            return sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer }).catch((e) => {
                winston.info(e);
            });
        });
    }
    sheetsClientFromRequest(redirect, tokens) {
        return __awaiter(this, void 0, void 0, function* () {
            const client = this.oauth2Client(redirect);
            client.setCredentials(tokens);
            return googleapis_1.google.sheets({ version: "v4", auth: client });
        });
    }
}
exports.GoogleSheetsAction = GoogleSheetsAction;
if (process.env.GOOGLE_SHEET_CLIENT_ID && process.env.GOOGLE_SHEET_CLIENT_SECRET) {
    Hub.addAction(new GoogleSheetsAction());
}
