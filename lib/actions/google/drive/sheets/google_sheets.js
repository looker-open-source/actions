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
const parse = require("csv-parse");
const googleapis_1 = require("googleapis");
const winston = require("winston");
const google_drive_1 = require("../google_drive");
const MAX_REQUEST_BATCH = process.env.GOOGLE_SHEETS_WRITE_BATCH ? Number(process.env.GOOGLE_SHEETS_WRITE_BATCH) : 4096;
const MAX_ROW_BUFFER_INCREASE = 4000;
const SHEETS_MAX_CELL_LIMIT = 5000000;
const MAX_RETRY_COUNT = 5;
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
                    winston.error(`Failed execute for Google Sheets.`, { webhookId: request.webhookId });
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
            const parents = request.formParams.folder ? [request.formParams.folder] : undefined;
            filename = this.sanitizeFilename(filename);
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
            if (!sheets.data.sheets ||
                sheets.data.sheets[0].properties === undefined ||
                sheets.data.sheets[0].properties.gridProperties === undefined) {
                throw "Now sheet data available";
            }
            // The ignore is here because Typescript is not correctly inferring that I have done existence checks
            const sheetId = sheets.data.sheets[0].properties.sheetId;
            let maxRows = sheets.data.sheets[0].properties.gridProperties.rowCount;
            const columns = sheets.data.sheets[0].properties.gridProperties.columnCount;
            const maxPossibleRows = Math.floor(SHEETS_MAX_CELL_LIMIT / columns);
            const requestBody = { requests: [] };
            let rowCount = 0;
            let finished = false;
            return request.stream((readable) => __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const csvparser = parse({
                            rtrim: true,
                            ltrim: true,
                            bom: true,
                        });
                        // This will not clear formulas or protected regions
                        yield this.clearSheet(spreadsheetId, sheet, sheetId);
                        csvparser.on("data", (line) => {
                            if (rowCount > maxPossibleRows) {
                                throw `Cannot send more than ${maxPossibleRows} without exceeding limit of 5 million cells in Google Sheets`;
                            }
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
                                    if (maxRows > maxPossibleRows) {
                                        winston.info(`Resetting back to max possible rows`, request.webhookId);
                                        maxRows = maxPossibleRows;
                                    }
                                    this.resize(maxRows, sheet, spreadsheetId, sheetId).catch((e) => {
                                        throw e;
                                    });
                                }
                                this.flush(requestCopy, sheet, spreadsheetId, request.webhookId).catch((e) => {
                                    winston.error(e, { webhookId: request.webhookId });
                                    throw e;
                                });
                            }
                        }).on("end", () => {
                            finished = true;
                            // @ts-ignore
                            if (requestBody.requests.length > 0) {
                                if (rowCount >= maxRows) {
                                    // Make sure we grow at least by requestlength.
                                    // Add MAX_ROW_BUFFER_INCREASE in addition to give headroom for more requests before
                                    // having to resize again
                                    const requestLen = requestBody.requests ? requestBody.requests.length : 0;
                                    winston.info(`Expanding max rows: ${maxRows} to ` +
                                        `${maxRows + requestLen + MAX_ROW_BUFFER_INCREASE}`, request.webhookId);
                                    maxRows = maxRows + requestLen + MAX_ROW_BUFFER_INCREASE;
                                    if (maxRows > maxPossibleRows) {
                                        winston.info(`Resetting back to max possible rows`, request.webhookId);
                                        maxRows = maxPossibleRows;
                                    }
                                    this.resize(maxRows, sheet, spreadsheetId, sheetId).catch((e) => {
                                        throw e;
                                    });
                                }
                                this.flush(requestBody, sheet, spreadsheetId, request.webhookId).catch((e) => {
                                    throw e;
                                }).then(() => {
                                    winston.info(`Google Sheets Streamed ${rowCount} rows including headers`, { webhookId: request.webhookId });
                                    resolve();
                                }).catch((e) => {
                                    winston.warn("End flush failed.", { webhookId: request.webhookId });
                                    reject(e);
                                });
                            }
                        }).on("error", (e) => {
                            winston.error(e, { webhookId: request.webhookId });
                            reject(e);
                        }).on("close", () => {
                            if (!finished) {
                                winston.warn(`Google Sheets Streaming closed socket before "end" event stream.`, { webhookId: request.webhookId });
                                reject(`"end" event not called before finishing stream`);
                            }
                        });
                        readable.pipe(csvparser);
                    }
                    catch (e) {
                        winston.error("Error thrown: " + e.toString(), { webhookId: request.webhookId });
                        reject(e.toString());
                    }
                }));
            }));
        });
    }
    clearSheet(spreadsheetId, sheet, sheetId) {
        return __awaiter(this, void 0, void 0, function* () {
            return sheet.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [
                        {
                            updateCells: {
                                range: {
                                    sheetId,
                                },
                                fields: "userEnteredValue",
                            },
                        },
                    ],
                },
            });
        });
    }
    resize(maxRows, sheet, spreadsheetId, sheetId) {
        return __awaiter(this, void 0, void 0, function* () {
            return sheet.spreadsheets.batchUpdate({
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
                throw e;
            });
        });
    }
    sanitizeFilename(filename) {
        return filename.split("'").join("\'");
    }
    flush(buffer, sheet, spreadsheetId, webhookId) {
        return __awaiter(this, void 0, void 0, function* () {
            return sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer }).catch((e) => __awaiter(this, void 0, void 0, function* () {
                winston.info(`Flush error: ${e}`, { webhookId });
                if (e.code === 429 && process.env.GOOGLE_SHEET_RETRY) {
                    winston.warn("Queueing retry", { webhookId });
                    return this.flushRetry(buffer, sheet, spreadsheetId);
                }
                else {
                    throw e;
                }
            }));
        });
    }
    flushRetry(buffer, sheet, spreadsheetId) {
        return __awaiter(this, void 0, void 0, function* () {
            let retrySuccess = false;
            let retryCount = 1;
            while (!retrySuccess && retryCount <= MAX_RETRY_COUNT) {
                retrySuccess = true;
                yield this.delay((Math.pow(3, retryCount)) * 1000);
                try {
                    return yield sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer });
                }
                catch (e) {
                    retrySuccess = false;
                    if (e.code === 429) {
                        winston.warn(`Retry number ${retryCount} failed`);
                        winston.info(e);
                    }
                    else {
                        throw e;
                    }
                    retryCount++;
                }
            }
            winston.warn("All retries failed");
            throw `Max retries attempted`;
        });
    }
    delay(time) {
        return __awaiter(this, void 0, void 0, function* () {
            yield new Promise((resolve) => {
                setTimeout(resolve, time);
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
