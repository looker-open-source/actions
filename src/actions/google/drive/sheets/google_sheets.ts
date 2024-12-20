import { HTTP_ERROR } from "../../../../error_types/http_errors"
import * as Hub from "../../../../hub"

import * as parse from "csv-parse"
import { Credentials } from "google-auth-library"
import { drive_v3, google, sheets_v4 } from "googleapis"
import { GaxiosPromise } from "googleapis-common"
import * as winston from "winston"
import { getHttpErrorType } from "../../../../error_types/utils"
import { Error, errorWith } from "../../../../hub"
import { GoogleDriveAction } from "../google_drive"
import Drive = drive_v3.Drive
import Sheet = sheets_v4.Sheets

const MAX_REQUEST_BATCH = process.env.GOOGLE_SHEETS_WRITE_BATCH ? Number(process.env.GOOGLE_SHEETS_WRITE_BATCH) : 4096
const SHEETS_MAX_CELL_LIMIT = 5000000
const MAX_RETRY_COUNT = 5
const RETRY_BASE_DELAY = process.env.GOOGLE_SHEETS_BASE_DELAY ? Number(process.env.GOOGLE_SHEETS_BASE_DELAY) : 3
const LOG_PREFIX = "[GOOGLE_SHEETS]"
const ROOT = "root"
const FOLDERID_REGEX = /\/folders\/(?<folderId>[^\/?]+)/
const RETRIABLE_CODES = [429, 500, 504, 503]

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
            await this.validateUserInDomainAllowlist(request.params.domain_allowlist,
                                                     stateJson.redirect,
                                                     stateJson.tokens,
                                                     request.webhookId)
                .catch((error) => {
                    winston.info(error + " - invalidating token", {webhookId: request.webhookId})
                    resp.success = false
                    resp.state = new Hub.ActionState()
                    resp.state.data = "reset"
                    return resp
            })

            const drive = await this.driveClientFromRequest(stateJson.redirect, stateJson.tokens)

            let filename = request.formParams.filename || request.suggestedFilename()
            if (!filename) {
                const error: Hub.Error = Hub.errorWith(
                    HTTP_ERROR.bad_request,
                    `${LOG_PREFIX} Error creating file name`,
                )
                resp.error = error
                resp.success = false
                resp.message = error.message
                resp.webhookId = request.webhookId
                winston.error(`${error.message}`, {error, webhookId: request.webhookId})
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

                const errorType = getHttpErrorType(e, this.name)
                let error: Error = errorWith(
                    errorType,
                    `${LOG_PREFIX} ${e.toString()}`,
                )

                if (e.code && e.errors && e.errors[0] && e.errors[0].message) {
                    error = {...error, http_code: e.code, message: `${errorType.description} ${LOG_PREFIX} ${e.errors[0].message}`}
                }

                resp.success = false
                resp.message = e.message
                resp.webhookId = request.webhookId
                resp.error = error
                winston.error(`${error.message}`, {error, webhookId: request.webhookId})
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
            "https://www.googleapis.com/auth/userinfo.email",
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
        let folder: string | undefined
        if (request.formParams.folderid) {
            winston.info("Using manual folder id")
            if (request.formParams.folderid.includes("my-drive")) {
                folder = ROOT
            } else {
                const match = request.formParams.folderid.match(FOLDERID_REGEX)
                if (match && match.groups) {
                    folder = match.groups.folderId
                } else {
                    folder = ROOT
                }
            }
        } else {
            folder = request.formParams.folder
        }
        const parents = folder ? [folder] : ROOT

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

        const files = await this.retriableFileList(drive, options, 0, request.webhookId!)
        .catch((e: any) => {
            this.sanitizeGaxiosError(e)
            winston.warn(`Error listing drives. Error ${e.toString()}`,
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
        const spreadsheetId = files.data.files[0].id

        const sheets = await this.retriableSpreadsheetGet(spreadsheetId, sheet,
                                                          0, request.webhookId!)
            .catch((e: any) => {
              this.sanitizeGaxiosError(e)
              winston.debug(`Error retrieving spreadsheet. Error ${e.toString()}`,
                            {webhookId: request.webhookId})
              throw e
            })
        if (!sheets.data.sheets || sheets.data.sheets[0].properties === undefined ||
            sheets.data.sheets[0].properties.gridProperties === undefined) {
          throw "Now sheet data available"
        }
        // The ignore is here because Typescript is not correctly inferring that I have done existence checks
        const sheetId = sheets.data.sheets[0].properties.sheetId as number
        const columns = sheets.data.sheets[0].properties.gridProperties.columnCount as number
        const maxPossibleRows = Math.floor(SHEETS_MAX_CELL_LIMIT / columns)
        const requestBody: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = {requests: []}
        let rowCount = 0
        let finished = false

        return request.stream(async (readable) => {
          return new Promise<void>(async (resolve, reject) => {
              try {
                  const promiseArray: Promise<any>[] = []
                  const csvparser = parse({
                      rtrim: true,
                      ltrim: true,
                      bom: true,
                      relax_column_count: true,
                  })

                  // This will not clear formulas or protected regions
                  await this.retriableClearSheet(spreadsheetId, sheet, sheetId, 0, request.webhookId!)

                  // Set the sheet's rows to max rows possible
                  winston.info(`Expanding sheet rows to ${maxPossibleRows}`, request.webhookId)
                  await this.retriableResize(
                    maxPossibleRows,
                    sheet,
                    spreadsheetId,
                    sheetId,
                    0,
                    request.webhookId!,
                  )

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
                          promiseArray.push(
                            this.flush(requestCopy, sheet, spreadsheetId, request.webhookId!)
                                .catch((e: any) => {
                                    this.sanitizeGaxiosError(e)
                                    winston.debug(e, {webhookId: request.webhookId})
                                    throw e
                                }),
                          )
                      }
                  }).on("end", () => {
                    finished = true
                    // @ts-ignore
                    if (requestBody.requests.length > 0) {
                        // Write any remaining rows to the sheet
                        promiseArray.push(
                            this.flush(requestBody, sheet, spreadsheetId, request.webhookId!)
                                .catch((e: any) => {
                                    this.sanitizeGaxiosError(e)
                                    winston.debug(e, {webhookId: request.webhookId})
                                    throw e
                                }),
                        )

                    }
                    Promise.all(promiseArray).then(() => {
                        winston.info(`Google Sheets Streamed ${rowCount} rows including headers`,
                                     {webhookId: request.webhookId})
                        resolve()
                    }).catch((e: any) => {
                        winston.warn("Flush failed.",
                                     {webhookId: request.webhookId})
                        reject(e)
                    })
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

    async retriableClearSheet(spreadsheetId: string, sheet: Sheet,
                              sheetId: number, attempt: number, webhookId: string):
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
      }).catch(async (e: any) => {
          this.sanitizeGaxiosError(e)
          winston.debug(`SpreadsheetG error: ${e}`, {webhookId})
          if (RETRIABLE_CODES.includes(e.code) && process.env.GOOGLE_SHEET_RETRY && attempt <= MAX_RETRY_COUNT) {
              winston.warn("Queueing retry for clear sheet", {webhookId})
              await this.delay((RETRY_BASE_DELAY ** (attempt)) * 1000)
              // Try again and increment attempt
              return this.retriableClearSheet(spreadsheetId, sheet, sheetId, attempt + 1, webhookId)
          } else {
              throw e
          }
      })
  }

      async retriableResize(maxRows: number, sheet: Sheet, spreadsheetId: string,
                            sheetId: number, attempt: number, webhookId: string):
                                GaxiosPromise<sheets_v4.Schema$BatchUpdateSpreadsheetResponse> {
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
        }).catch(async (e: any) => {
            this.sanitizeGaxiosError(e)
            winston.debug(`SpreadsheetG error: ${e}`, {webhookId})
            if (RETRIABLE_CODES.includes(e.code) && process.env.GOOGLE_SHEET_RETRY && attempt <= MAX_RETRY_COUNT) {
                winston.warn("Queueing retry for resize sheet", {webhookId})
                await this.delay((RETRY_BASE_DELAY ** (attempt)) * 1000)
                // Try again and increment attempt
                return this.retriableResize(maxRows, sheet, spreadsheetId, sheetId, attempt + 1, webhookId)
            } else {
                throw e
            }
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
          if (RETRIABLE_CODES.includes(e.code) && process.env.GOOGLE_SHEET_RETRY && attempt <= MAX_RETRY_COUNT) {
              winston.warn("Queueing retry for read", {webhookId})
              await this.delay((RETRY_BASE_DELAY ** (attempt)) * 1000)
              // Try again and increment attempt
              return this.retriableSpreadsheetGet(spreadsheetId, sheet, attempt + 1, spreadsheetId)
          } else {
              throw e
          }
      })
  }
      async retriableFileList(drive: Drive, options: any, attempt: number, webhookId: string): Promise<any> {
          return await drive.files.list(options).catch(async (e: any) => {
              this.sanitizeGaxiosError(e)
              winston.debug(`SpreadsheetG error: ${e}`, {webhookId})
              if (RETRIABLE_CODES.includes(e.code) && process.env.GOOGLE_SHEET_RETRY && attempt <= MAX_RETRY_COUNT) {
                  winston.warn("Queueing retry for file list", {webhookId})
                  await this.delay((RETRY_BASE_DELAY ** (attempt)) * 1000)
                  // Try again and increment attempt
                  return this.retriableFileList(drive, options, attempt + 1, webhookId)
              } else {
                  throw e
              }
          })
      }

      async flush(buffer: sheets_v4.Schema$BatchUpdateSpreadsheetRequest,
                  sheet: Sheet, spreadsheetId: string, webhookId: string) {
                      return sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer})
                          .catch(async (e: any) => {
                          this.sanitizeGaxiosError(e)
                          winston.debug(`Flush error: ${e}`, {webhookId})
                          // If we turned retries off do not attempt to retry and just throw
                          if (!process.env.GOOGLE_SHEET_RETRY) {
                              throw e
                              // if this is a too many request, we can retry
                          } else if (RETRIABLE_CODES.includes(e.code)) {
                              winston.warn(`Queueing retry for ${e.code}`, {webhookId})
                              return this.flushRetry(buffer, sheet, spreadsheetId, webhookId)
                          } else {
                              throw e
                          }
                      })
                  }

    async flushRetry(buffer: sheets_v4.Schema$BatchUpdateSpreadsheetRequest,
                     sheet: Sheet, spreadsheetId: string, webhookId: string) {
                       let retrySuccess = false
                       let retryCount = 1
                       while (!retrySuccess && retryCount <= MAX_RETRY_COUNT) {
                           retrySuccess = true
                           await this.delay((RETRY_BASE_DELAY ** retryCount) * 1000)
                           try {
                               return await sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer})
                           } catch (e: any) {
                               this.sanitizeGaxiosError(e)
                               retrySuccess = false
                               if (RETRIABLE_CODES.includes(e.code)) {
                                   winston.info(`Retry number ${retryCount} for writeBatch failed`, {webhookId})
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
