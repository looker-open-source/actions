import * as Hub from "../../../../hub"

import {GoogleDriveAction} from "../google_drive"

export class GoogleSheetsAction extends GoogleDriveAction {
    name = "google_sheets"
    label = "Google Sheets"
    iconName = "google/sheets/sheets.svg"
    description = "Create a new Google Sheet."
    supportedActionTypes = [Hub.ActionType.Query]
    supportedFormats = [Hub.ActionFormat.Csv]
    mimeType = "application/vnd.google-apps.spreadsheet"
}

if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
  Hub.addAction(new GoogleSheetsAction())
}
