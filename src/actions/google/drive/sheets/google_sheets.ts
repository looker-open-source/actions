import * as Hub from "../../../../hub"

import * as parse from "csv-parse"
import {Credentials} from "google-auth-library"
import {drive_v3, google, sheets_v4} from "googleapis"
import {GaxiosPromise} from "googleapis-common"
import * as winston from "winston"
import {GoogleDriveAction} from "../google_drive"
import Drive = drive_v3.Drive
import Sheet = sheets_v4.Sheets

const MAX_REQUEST_BATCH = process.env.GOOGLE_SHEETS_WRITE_BATCH ? Number(process.env.GOOGLE_SHEETS_WRITE_BATCH) : 4096
const MAX_ROW_BUFFER_INCREASE = 6000
const SHEETS_MAX_CELL_LIMIT = 5000000
const MAX_RETRY_COUNT = 5

export class GoogleSheetsAction extends GoogleDriveAction {
    name = "google_sheets"
    label = "Google Sheets"
    iconName = "google/drive/sheets/sheets.svg"
    description = "Create a new Google Sheet."
    supportedActionTypes = [Hub.ActionType.Query]
    supportedFormats = [Hub.ActionFormat.Csv]
    executeInOwnProcess = true
    mimeType = "application/vnd.google-apps.spreadsheet"

    async execute(request: Hub.ActionRequest) {
        const resp = new Hub.ActionResponse()

        if (!request.params.state_json) {
            resp.success = false
            resp.state = new Hub.ActionState()
            resp.state.data = "reset"
            return resp
        }

        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.tokens && stateJson.redirect) {
            const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens)

            let filename = request.formParams.filename || request.suggestedFilename()
            if (!filename) {
                resp.success = false
                resp.message = "Error creating filename"
                return resp
            } else if (!filename.match(/\.csv$/)) {
                filename = filename.concat(".csv")
            }
            try {
                if (request.formParams.overwrite === "yes") {
                    const sheet = await this.sheetsClientFromRequest(stateJson.redirect, stateJson.tokens)
                    await this.sendOverwriteData(filename, request, drive, sheet)
                    resp.success = true
                } else {
                    await this.sendData(filename, request, drive)
                    resp.success = true
                }
            } catch (e: any) {
                this.sanitizeGaxiosError(e)
                winston.error(`Failed execute for Google Sheets. Error: ${e.toString()}`,
                    {webhookId: request.webhookId})
                resp.success = false
                resp.message = e.toString()
            }
        } else {
            resp.success = false
            resp.state = new Hub.ActionState()
            resp.state.data = "reset"
        }
        return resp
    }

    async form(request: Hub.ActionRequest) {
        const form = await super.form(request)
        if (form.fields[0].type !== "oauth_link_google") {
            form.fields.push({
                description: "Should this action attempt to overwrite an existing file",
                label: "Overwrite Existing Files",
                name: "overwrite",
                options: [{name: "yes", label: "Yes"}, {
                    name: "no",
                    label: "No",
                }],
                default: "yes",
                required: true,
                type: "select",
            })
        }
        return form
    }

    async oauthUrl(redirectUri: string, encryptedState: string) {
        const oauth2Client = this.oauth2Client(redirectUri)

        // generate a url that asks permissions for Google Drive scope
        const scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]

        const url = oauth2Client.generateAuthUrl({
            access_type: "offline",
            scope: scopes,
            prompt: "consent",
            state: encryptedState,
        })
        return url.toString()
    }

    async sendOverwriteData(filename: string, request: Hub.ActionRequest, drive: Drive, sheet: Sheet) {
        const parents = request.formParams.folder ? [request.formParams.folder] : undefined

        filename = this.sanitizeFilename(filename)
        const options: any = {
            q: `name = '${filename}' and '${parents}' in parents and trashed=false`,
            fields: "files",
        }

        if (request.formParams.drive !== undefined && request.formParams.drive !== "mydrive") {
            options.driveId = request.formParams.drive
            options.includeItemsFromAllDrives = true
            options.supportsAllDrives = true
            options.corpora = "drive"
        } else {
            options.corpora = "user"
        }

        const files = await drive.files.list(options).catch((e: any) => {
            this.sanitizeGaxiosError(e)
            winston.debug(`Error listing drives. Error ${e.toString()}`,
                {webhookId: request.webhookId})
            throw e
        })
        if (files.data.files === undefined || files.data.files.length === 0) {
            winston.debug(`New file: ${filename}`,
                {webhookId: request.webhookId})
            return this.sendData(filename, request, drive)
        }
        if (files.data.files[0].id === undefined) {
            throw "No spreadsheet ID"
        }
        const spreadsheetId = files.data.files[0].id!

        const sheets = await this.retriableSpreadsheetGet(spreadsheetId, sheet,
            0, request.webhookId!).catch((e: any) => {
                this.sanitizeGaxiosError(e)
                winston.debug(`Error retrieving spreadsheet. Error ${e.toString()}`,
                    {webhookId: request.webhookId})
                throw e
            })
        if (!sheets.data.sheets ||
            sheets.data.sheets[0].properties === undefined ||
            sheets.data.sheets[0].properties.gridProperties === undefined) {
            throw "Now sheet data available"
        }
        // The ignore is here because Typescript is not correctly inferring that I have done existence checks
        const sheetId = sheets.data.sheets[0].properties.sheetId as number
        let maxRows = sheets.data.sheets[0].properties.gridProperties.rowCount as number
        const columns = sheets.data.sheets[0].properties.gridProperties.columnCount as number
        const maxPossibleRows = Math.floor(SHEETS_MAX_CELL_LIMIT / columns)
        const requestBody: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = {requests: []}
        let rowCount = 0
        let finished = false

        return request.stream(async (readable) => {
            return new Promise<void>(async (resolve, reject) => {
                try {
                    const csvparser = parse({
                        rtrim: true,
                        ltrim: true,
                        bom: true,
                    })
                    // This will not clear formulas or protected regions
                    await this.clearSheet(spreadsheetId, sheet, sheetId)
                    csvparser.on("data", (line: any) => {
                        if (rowCount > maxPossibleRows) {
                            reject(`Cannot send more than ${maxPossibleRows} without exceeding limit of 5 million cells in Google Sheets`)
                        }
                        const rowIndex: number = rowCount++
                        // Sanitize line data and properly encapsulate string formatting for CSV lines
                        const lineData = line.map((record: string) => {
                            record = record.replace(/\"/g, "\"\"")
                            return `"${record}"`
                        }).join(",") as string
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
                        })
                        // @ts-ignore
                        if (requestBody.requests.length > MAX_REQUEST_BATCH) {
                            const requestCopy: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = {}
                            // Make sure to do a deep copy of the request
                            Object.assign(requestCopy, requestBody)
                            requestBody.requests = []
                            if (rowCount >= maxRows) {
                                // Make sure we grow at least by requestlength.
                                // Add MAX_ROW_BUFFER_INCREASE in addition to give headroom for more requests before
                                // having to resize again
                                const requestLen = requestCopy.requests ? requestCopy.requests.length : 0
                                winston.info(`Expanding max rows: ${maxRows} to ` +
                                    `${maxRows + requestLen + MAX_ROW_BUFFER_INCREASE}`, request.webhookId)
                                maxRows = maxRows + requestLen + MAX_ROW_BUFFER_INCREASE
                                if (maxRows > maxPossibleRows) {
                                    winston.info(`Resetting back to max possible rows`, request.webhookId)
                                    maxRows = maxPossibleRows
                                }
                                this.resize(maxRows, sheet, spreadsheetId, sheetId).catch((e: any) => {
                                    this.sanitizeGaxiosError(e)
                                    winston.debug(e.toString(), {webhookId: request.webhookId})
                                    throw e
                                })
                            }
                            this.flush(requestCopy, sheet, spreadsheetId, request.webhookId!).catch((e: any) => {
                                this.sanitizeGaxiosError(e)
                                winston.debug(e, {webhookId: request.webhookId})
                                throw e
                            })
                        }
                    }).on("end", () => {
                        finished = true
                        // @ts-ignore
                        if (requestBody.requests.length > 0) {
                            if (rowCount >= maxRows) {
                                // Make sure we grow at least by requestlength.
                                // Add MAX_ROW_BUFFER_INCREASE in addition to give headroom for more requests before
                                // having to resize again
                                const requestLen = requestBody.requests ? requestBody.requests.length : 0
                                winston.info(`Expanding max rows: ${maxRows} to ` +
                                    `${maxRows + requestLen + MAX_ROW_BUFFER_INCREASE}`, request.webhookId)
                                maxRows = maxRows + requestLen + MAX_ROW_BUFFER_INCREASE
                                if (maxRows > maxPossibleRows) {
                                    winston.info(`Resetting back to max possible rows`, request.webhookId)
                                    maxRows = maxPossibleRows
                                }
                                this.resize(maxRows, sheet, spreadsheetId, sheetId).catch((e: any) => {
                                    this.sanitizeGaxiosError(e)
                                    winston.debug(`Resize failed: rowCount: ${maxRows}`, request.webhookId)
                                    throw e
                                })
                            }
                            this.flush(requestBody, sheet, spreadsheetId, request.webhookId!).then(() => {
                                winston.info(`Google Sheets Streamed ${rowCount} rows including headers`,
                                    {webhookId: request.webhookId})
                                resolve()
                            }).catch((e) => {
                                winston.warn("End flush failed.",
                                    {webhookId: request.webhookId})
                                reject(e)
                            })
                        }
                    }).on("error", (e: any) => {
                        winston.debug(e, {webhookId: request.webhookId})
                        reject(e)
                    }).on("close", () => {
                        if (!finished) {
                            winston.warn(`Google Sheets Streaming closed socket before "end" event stream.`,
                                {webhookId: request.webhookId})
                            reject(`"end" event not called before finishing stream`)
                        }
                    })
                    readable.pipe(csvparser)
                } catch (e: any) {
                    winston.debug("Error thrown: " + e.toString(), {webhookId: request.webhookId})
                    reject(e.toString())
                }
            })
            })
    }

    async clearSheet(spreadsheetId: string, sheet: Sheet, sheetId: number):
        GaxiosPromise<sheets_v4.Schema$ClearValuesResponse>  {
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
        })
    }

    async resize(maxRows: number, sheet: Sheet, spreadsheetId: string, sheetId: number) {
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
        }).catch((e: any) => {
            this.sanitizeGaxiosError(e)
            throw e
        })
    }

    sanitizeFilename(filename: string) {
        return filename.split("'").join("\'")
    }

    async retriableSpreadsheetGet(spreadsheetId: string, sheet: Sheet,
                                  attempt: number, webhookId: string): Promise<any> {
        return await sheet.spreadsheets.get({spreadsheetId}).catch(async (e: any) => {
            this.sanitizeGaxiosError(e)
            winston.debug(`SpreadsheetG error: ${e}`, {webhookId})
            if (e.code === 429 && process.env.GOOGLE_SHEET_RETRY && attempt <= MAX_RETRY_COUNT) {
                winston.warn("Queueing retry", {webhookId})
                await this.delay((3 ** (attempt + 1)) * 1000)
                return this.retriableSpreadsheetGet(spreadsheetId, sheet, attempt, spreadsheetId)
            } else {
                throw e
            }
        })
    }

    async flush(buffer: sheets_v4.Schema$BatchUpdateSpreadsheetRequest,
                sheet: Sheet, spreadsheetId: string, webhookId: string) {
        return sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer}).catch(async (e: any) => {
            this.sanitizeGaxiosError(e)
            winston.debug(`Flush error: ${e}`, {webhookId})
            if (e.code === 429 && process.env.GOOGLE_SHEET_RETRY) {
                winston.warn("Queueing retry", {webhookId})
                return this.flushRetry(buffer, sheet, spreadsheetId)
            } else {
                throw e
            }
        })
    }

    async flushRetry(buffer: sheets_v4.Schema$BatchUpdateSpreadsheetRequest, sheet: Sheet, spreadsheetId: string) {
        let retrySuccess = false
        let retryCount = 1
        while (!retrySuccess && retryCount <= MAX_RETRY_COUNT) {
            retrySuccess = true
            await this.delay((3 ** retryCount) * 1000)
            try {
                return await sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer})
            } catch (e: any) {
                this.sanitizeGaxiosError(e)
                retrySuccess = false
                if (e.code === 429) {
                    winston.debug(`Retry number ${retryCount} failed`)
                    winston.debug(e)
                } else {
                    throw e
                }
                retryCount++
            }
        }
        winston.warn("All retries failed")
        throw `Max retries attempted`
    }

    protected async delay(time: number) {
        await new Promise<void>((resolve) => {
            setTimeout(resolve, time)
        })
    }

    protected async sheetsClientFromRequest(redirect: string, tokens: Credentials) {
        const client = this.oauth2Client(redirect)
        client.setCredentials(tokens)
        return google.sheets({version: "v4", auth: client})
    }
}

if (process.env.GOOGLE_SHEET_CLIENT_ID && process.env.GOOGLE_SHEET_CLIENT_SECRET) {
  Hub.addAction(new GoogleSheetsAction())
}
