import * as Hub from "../../../../hub"

import * as AdmZip from "adm-zip"
import {IZipEntry} from "adm-zip"
import {Mutex} from "async-mutex"
import * as parse from "csv-parse"
import {Credentials} from "google-auth-library"
import {drive_v3, google, sheets_v4} from "googleapis"
import {PassThrough} from "stream"
import * as winston from "winston"
import Drive = drive_v3.Drive
import Sheet = sheets_v4.Sheets
import {GoogleDriveAction} from "../google_drive"

const MAX_REQUEST_BATCH = 500

export class GoogleSheetsDashboardAction extends GoogleDriveAction {
  name = "google_sheets_dashboard"
  label = "Google Sheets Dashboard"
  iconName = "google/drive/sheets/sheets.svg"
  description = "Create a new Google Sheet with Dashboard Data."
  supportedActionTypes = [Hub.ActionType.Dashboard]
  supportedFormats = [Hub.ActionFormat.CsvZip]
  executeInOwnProcess = true
  usesStreaming = false
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

      const filename = request.formParams.filename || request.suggestedFilename()
      if (!filename) {
        resp.success = false
        resp.message = "Error creating filename"
        return resp
      }
      try {
          const sheet = await this.sheetsClientFromRequest(stateJson.redirect, stateJson.tokens)
          const shouldOverwrite = request.formParams.overwrite === "yes"
          await this.sendSheetData(filename, request, drive, sheet, shouldOverwrite)
          resp.success = true
      } catch (e) {
        resp.success = false
        resp.message = e.message
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
        options: [{name: "yes", label: "Yes"}, {name: "no", label: "No"}],
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

  // tslint:disable-next-line:max-line-length
  async sendSheetData(filename: string, request: Hub.ActionRequest, drive: Drive, sheet: Sheet, shouldOverwrite: boolean) {
    const parents = request.formParams.folder ? [request.formParams.folder] : undefined

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

    // Get the dashboard info and make sure there is a spreadsheet created
    const files = await drive.files.list(options)
    let spreadsheetId = ""
    if (files.data.files === undefined || files.data.files.length === 0 || !shouldOverwrite) {
      winston.info(`New file: ${filename}`)
      const response = await sheet.spreadsheets.create({
        requestBody: {
          properties: {
            title: filename,
          },
        },
        fields: "spreadsheetId",
      })
      if (!response.data.spreadsheetId) {
        winston.info(JSON.stringify(response.data))
        throw "Spreadsheet not created"
      }
      spreadsheetId = response.data.spreadsheetId
    } else {
      if (files.data.files === undefined || files.data.files[0].id === undefined) {
        throw "No spreadsheet ID for overwrite"
      }
      winston.info(`found sheet: ${filename}`)
      // @ts-ignore
      spreadsheetId = files.data.files[0].id
    }

    const sheetResponse = await sheet.spreadsheets.get({spreadsheetId})

    const sheets = sheetResponse.data.sheets
    winston.info(JSON.stringify(sheets))
    if (sheets === undefined) {
      throw "What the heckers"
    }

    if (request.attachment === undefined || request.attachment.dataBuffer === undefined) {
      throw "No Data to send?"
    }
    const zip = new AdmZip(request.attachment.dataBuffer)
    const entries = zip.getEntries()
    const promiseArray: Promise<void>[] = []
    // @ts-ignore
    entries.forEach(async (entry) => {
      // @ts-ignore
      const promise = new Promise<void>(async (res, rej) => {
        const parsedName = entry.name.substring(0, (entry.name.length - 4))
        winston.info(parsedName)
        let found = sheets.find((s) => {
          if (s.properties === undefined) {
            return false
          }
          return s.properties.title === parsedName
        })

        if (!found) {
          const addSheetResponse = await this.addSheet(spreadsheetId, parsedName, sheet)
          winston.info(`Sheet: ${JSON.stringify(addSheetResponse.data.updatedSpreadsheet)}`)
          if (addSheetResponse.data.updatedSpreadsheet) {
            found = addSheetResponse.data.updatedSpreadsheet
          } else {
            rej("No sheet created")
          }
        }

        if (found && found.properties && found.properties.sheetId !== undefined) {
          await this.clearSheet(spreadsheetId, found.properties.sheetId, sheet)
        }

        // @ts-ignore
        await this.streamCsvData(spreadsheetId, found, sheet, entry, res)
      })
      promiseArray.push(promise)
    })
    return Promise.all(promiseArray).catch((e) => {
      winston.error(JSON.stringify(e))
    })
  }

  // tslint:disable-next-line:max-line-length
  async streamCsvData(spreadsheetId: string, foundSheet: sheets_v4.Schema$Spreadsheet, sheet: Sheet, entry: IZipEntry, res: any) {
    const mutex = new Mutex()
    // @ts-ignore
    const sheetId = foundSheet.properties.sheetId as number
    // @ts-ignore
    let maxRows = foundSheet.properties.gridProperties.rowCount as number

    const requestBody: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = {requests: []}
    let rowCount = 0
    const csvparser = parse()
    // This will not clear formulas or protected regions
    csvparser.on("data", async (line: any) => {
      if (rowCount > maxRows) {
        maxRows += 1000
        // @ts-ignore
        await mutex.runExclusive(async () => {
          await sheet.spreadsheets.batchUpdate({
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
            throw e
          })
        }).catch((e: any) => {
          throw e
        })
      }
      const rowIndex: number = rowCount++
      // @ts-ignore
      requestBody.requests.push({
        pasteData: {
          coordinate: {
            sheetId,
            columnIndex: 0,
            rowIndex,
          },
          data: line.map((v: any) => `"${v}"` ).join(",") as string,
          delimiter: ",",
          type: "PASTE_NORMAL",
        },
      })
      // @ts-ignore
      if (requestBody.requests.length > MAX_REQUEST_BATCH) {
        await mutex.runExclusive(async () => {
          // @ts-ignore
          if (requestBody.requests.length < MAX_REQUEST_BATCH) {
            return
          }
          const requestCopy: sheets_v4.Schema$BatchUpdateSpreadsheetRequest = {}
          Object.assign(requestCopy, requestBody)
          requestBody.requests = []
          await this.flush(requestCopy, sheet, spreadsheetId).catch((e: any) => {
            winston.error(e)
          })
        }).catch((e: any) => {
          throw e
        })
      }
    }).on("end", async () => {
      // @ts-ignore
      if (requestBody.requests.length > 0) {
        await mutex.runExclusive(async () => {
          await this.flush(requestBody, sheet, spreadsheetId).then(() => {
            winston.info(`Google Sheets Streamed ${rowCount} rows including headers`)
            res()
          }).catch((e: any) => {
            throw e
          })
        }).catch((e: any) => {
          throw e
        })
      }
    }).on("error", (e: any) => {
      winston.error(e)
      throw e
    })
    const buffer = entry.getData()
    const stream = new PassThrough()
    stream.pipe(csvparser)
    stream.end(buffer)
  }

  async clearSheet(spreadsheetId: string, sheetId: number, sheet: Sheet) {
    return sheet.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          updateCells: {
            range: {
              sheetId,
            },
            fields: "userEnteredValue",
          },
        }],
      },
    }).catch((err) => {
      winston.error(err)
      throw err
    })
  }

  async addSheet(spreadsheetId: string, title: string, sheet: Sheet) {
    await sheet.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: {
              title,
              gridProperties: {
                rowCount: 5000,
                columnCount: 26,
              },
            },
          },
        }],
      },
    }).catch((err) => {
      winston.error(err)
      throw err
    })
    const sheetResponse = await sheet.spreadsheets.get({spreadsheetId})
    if (sheetResponse.data.sheets) {
      return sheetResponse.data.sheets.find((s) => {
        // todo refecth le data
      })
    }
  }

  async flush(buffer: sheets_v4.Schema$BatchUpdateSpreadsheetRequest, sheet: Sheet, spreadsheetId: string) {
    return sheet.spreadsheets.batchUpdate({ spreadsheetId, requestBody: buffer}).catch((e: any) => {
      winston.info(e)
    })
  }

  oauth2Client(redirectUri: string | undefined) {
    return new google.auth.OAuth2(
      process.env.GOOGLE_SHEET_CLIENT_ID,
      process.env.GOOGLE_SHEET_CLIENT_SECRET,
      redirectUri,
    )
  }

  protected async sheetsClientFromRequest(redirect: string, tokens: Credentials) {
    const client = this.oauth2Client(redirect)
    client.setCredentials(tokens)
    return google.sheets({version: "v4", auth: client})
  }

}

if (process.env.GOOGLE_SHEET_CLIENT_ID && process.env.GOOGLE_SHEET_CLIENT_SECRET) {
  Hub.addAction(new GoogleSheetsDashboardAction())
}
