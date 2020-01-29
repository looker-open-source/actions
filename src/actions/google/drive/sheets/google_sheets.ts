import * as Hub from "../../../../hub"

import {drive_v3} from "googleapis"
import Drive = drive_v3.Drive
import {GoogleDriveAction} from "../google_drive"

export class GoogleSheetsAction extends GoogleDriveAction {
    name = "google_sheets"
    label = "Google Sheets"
    iconName = "google/drive/sheets/sheets.svg"
    description = "Create a new Google Sheet."
    supportedActionTypes = [Hub.ActionType.Query]
    supportedFormats = [Hub.ActionFormat.Csv]
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
                    await this.sendOverwriteData(filename, request, drive)
                    resp.success = true
                } else {
                    await this.sendData(filename, request, drive)
                    resp.success = true
                }
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
        if (form.fields[0].type !== "oauth_link") {
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

    async sendOverwriteData(filename: string, request: Hub.ActionRequest, drive: Drive) {
        const parents = request.formParams.folder ? [request.formParams.folder] : undefined
        const files = await drive.files.list({
            q: `name = '${filename}' and '${parents}' in parents`,
            fields: "files",
        })
        if (files.data.files === undefined || files.data.files.length === 0) {
            return this.sendData(filename, request, drive)
        }
        return request.stream(async (readable) => {
            return drive.files.update({
                // @ts-ignore
                fileId: files.data.files[0].id,
                media: {
                    mimeType: this.mimeType,
                    body: readable,
                },
            })
        })
    }
}

if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_CLIENT_SECRET) {
  Hub.addAction(new GoogleSheetsAction())
}
