import * as Hub from "../../../../hub";
import { Credentials } from "google-auth-library";
import { drive_v3, sheets_v4 } from "googleapis";
import Drive = drive_v3.Drive;
import Sheet = sheets_v4.Sheets;
import { GoogleDriveAction } from "../google_drive";
export declare class GoogleSheetsAction extends GoogleDriveAction {
    name: string;
    label: string;
    iconName: string;
    description: string;
    supportedActionTypes: Hub.ActionType[];
    supportedFormats: Hub.ActionFormat[];
    executeInOwnProcess: boolean;
    mimeType: string;
    execute(request: Hub.ActionRequest): Promise<Hub.ActionResponse>;
    form(request: Hub.ActionRequest): Promise<Hub.ActionForm>;
    oauthUrl(redirectUri: string, encryptedState: string): Promise<string>;
    sendOverwriteData(filename: string, request: Hub.ActionRequest, drive: Drive, sheet: Sheet): Promise<void | import("gaxios").GaxiosResponse<drive_v3.Schema$File>>;
    clearSheet(spreadsheetId: string, sheet: Sheet): Promise<import("gaxios").GaxiosResponse<sheets_v4.Schema$ClearValuesResponse>>;
    flush(buffer: sheets_v4.Schema$BatchUpdateSpreadsheetRequest, sheet: Sheet, spreadsheetId: string): Promise<void | import("gaxios").GaxiosResponse<sheets_v4.Schema$BatchUpdateSpreadsheetResponse>>;
    protected sheetsClientFromRequest(redirect: string, tokens: Credentials): Promise<sheets_v4.Sheets>;
}
