import * as https from "request-promise-native"

import * as uuid from "uuid"
import * as winston from "winston"
import * as Hub from "../../hub"

const sizeof = require("object-sizeof")
const MAX_DATA_BYTES = 500
// const signedUrl = "https://api-dev.kloud.io/v1/tools/signed-url-put-object?key="
const signedUrl = "https://api-test.kloud.io/v1/tools/signed-url-put-object?key="
// const API_URL = "https://9zwd9odg8i.execute-api.us-west-2.amazonaws.com/dev/dest/send"
const API_URL = "https://czd7a5synj.execute-api.us-west-2.amazonaws.com/test/dest/send"
let s3Bool = false
let data = {}

export class KloudioAction extends Hub.Action {

  name = "kloudio"
  label = "Kloudio"
  iconName = "kloudio/kloudio.svg"
  description = "Add records to a Google Spreadsheet."
  // usesStreaming = true
  params = []
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  supportedDownloadSettings = [Hub.ActionDownloadSettings.Url]

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
        throw "No attached json."
    }

    if (!(request.formParams.apiKey)) {
        throw "Missing API key"
    }

    if (!( request.formParams.url)) {
        throw "Missing Google sheets URL"
    }

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }

    winston.info(request.formParams.apiKey)
    winston.info(request.formParams.url)
    winston.info(typeof request.attachment.dataJSON)
    // winston.info(JSON.stringify(request.attachment.dataJSON.data))

    const { spreadsheetId, sheetId }  = await parseGsheet(request.formParams.url)
    // const gsheeturl = encodeURIComponent(request.formParams.url)
    winston.info("encoded gsheet url " + spreadsheetId + " " + sheetId)

    // const dataFile = JSON.stringify(request.attachment.dataJSON)
    const labels = request.attachment.dataJSON.fields.dimensions.map((label: { label: any; }) => label.label)
    winston.info(labels[0])
    const finalLabels = []
    finalLabels.push(labels)
    winston.info(finalLabels[0])
    const names = request.attachment.dataJSON.fields.dimensions.map((labelId: { name: any; }) => labelId.name)
    winston.info(names[0])
    const dataRows = await parseData(request.attachment.dataJSON.data, names, finalLabels)
    winston.info("first of row data is " + JSON.stringify(dataRows[0]))
    //

    const dataSize = sizeof(dataRows)
    // winston.info("size of original data" + sizeof(request.attachment.dataJSON))
    winston.info("size of data" + dataSize)
    if ( dataSize > MAX_DATA_BYTES) {
        s3Bool = true
        const anonymousId = this.generateAnonymousId() + ".json"
        winston.info("uuid is" + anonymousId)
        const s3SignedUrl = await getS3Url(anonymousId, signedUrl, request.formParams.apiKey)
        // winston.info("after getting signed URL s3...", s3SignedUrl.signedURL)
        const s3Response1 = await uploadToS32(s3SignedUrl.signedURL, dataRows)
        winston.info("after uploading the file to s3...", s3Response1)
        data = {destination: "looker", apiKey: request.formParams.apiKey, spreadsheetId , sheetId,
            s3Upload: s3Bool, data: anonymousId}
    } else {
        data = {destination: "looker", apiKey: request.formParams.apiKey, spreadsheetId , sheetId,
            s3Upload: s3Bool, data: dataRows}
    }

    let response
    try {
        const newUri = API_URL.replace(/['"]+/g, "")
        // winston.info("uri is:" + API_URL)
        winston.info("Lambda new uri is:" + newUri)
       // console.log("uri is:" + uri);
        const lambdaResponse = await https.post({
        url: newUri,
        headers: {"Content-Type": "application/json"},
        json: true,
        body: data,
         }).catch((_err) => {
           const error = JSON.parse(_err)
           winston.info("parsing error code" + error.emailCode)
           winston.error(_err.toString())
          })
        winston.info("lambda url resp " + lambdaResponse)

        if (!lambdaResponse.success || lambdaResponse.success === false) {
          winston.info("lambda url resp is not sucess " + lambdaResponse)
          response = { success: false, message: lambdaResponse.message }
        } else {
          response = { success: true, message: lambdaResponse.message }
        }
        // tslint:disable-next-line: variable-name
        // response = { success: true, message: "data uploaded" }

        // code to call lambda function
       /* const lambResp = await lambdaDest(data)
        winston.info(lambResp)
        // const parseLambda = JSON.parse(lambResp.Payload)
        if (lambResp.statusCode !== 200) {
          response = { success: false, message: lambResp.body.error }
        } else {
          response = { success: true, message: "data uploaded" }
        }*/

    } catch (e) {
      winston.info("Inside catch statement" + e)
      response = { success: false, message: e.message }
    }
    winston.info("JSON stringify response" + JSON.stringify(response))
    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()
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
    }]
    return form
  }

  protected generateAnonymousId() {
    return uuid.v4()
  }

}

async function parseData(lookerData: any, names: any, labels: any) {
    const dataLen = lookerData.length
    const rowL = names.length
    winston.info("length of data is " +  dataLen)
    winston.info("length of row is " +  rowL)
    return new Promise<any>( async (resolve, reject) => {
        try {
            for (const row of lookerData) {
                const tempA = []
                for (const label of names) {
                    if (row[label].rendered) {
                        tempA.push(row[label].rendered)
                    } else {
                        tempA.push(row[label].value)
                    }
                }
                labels.push(tempA)
            }
            return resolve(labels)
        } catch (error) {
            return reject(error)
        }
    })
}

async function getS3Url(fileName: any, url: any, token: any ) {

  const comurl = url + fileName + "&apiKey=" + token
  const apiURL = comurl.replace(/['"]+/g, "")
  winston.info("printing kloudio URl..." + apiURL)
  const response = await https.get({
    url: apiURL,
    headers: { ContentType: "application/json"},
     }).catch((_err) => { winston.error(_err.toString()) })
  return JSON.parse(response)
}

async function uploadToS32(url: any, s3Data1: any) {

  const santUrl = url.replace(/['"]+/g, "")
  const response = https.put({
    url: santUrl,
    headers: {"Content-Type": "application/json"},
    json: true,
    body: s3Data1,
     }).catch((_err) => { winston.error(_err.toString()) })

  return response
}

async function parseGsheet(gsheet: string) {
  const urlRegex = /(https:\/\/docs.google.com\/spreadsheets\/d\/[a-zA-Z0-9_-]*\/edit#gid=[0-9]*)/g
  if (!urlRegex.test(gsheet)) {
    throw new Error("Invalid url")
  }
  const slashArray = gsheet.split("/")
  const spreadsheetId = slashArray[5]
  const assignmentArray = slashArray[6].split("=")
  const sheetId = assignmentArray[1]
  return {spreadsheetId, sheetId}
}
Hub.addAction(new KloudioAction())
