import * as AWS from "aws-sdk"
import * as https from "request-promise-native"
import * as uuid from "uuid"
import * as winston from "winston"
import * as Hub from "../../hub"

const sizeof = require("object-sizeof")
const MAX_DATA_BYTES = 5000
const s3bucket = "kloudio-data-files"
const API_URL = "https://3dd5d0ed.ngrok.io/sandbox"
let s3Bool = false
let data = {}

export class KloudioAction extends Hub.Action {

  name = "kloudio"
  label = "Kloudio"
  iconName = "kloudio/kloudio.svg"
  description = "Add records to a Google Spreadsheet."
  // usesStreaming = true
  params = [
    {
        description: "AWS Access KEY for S3",
        label: "AWS Acess Key",
        name: "aws_access_key",
        required: true,
        sensitive: true,
      },
      {
        description: "AWS Secret KEY for S3",
        label: "AWS Secret Key",
        name: "aws_secret_key",
        required: true,
        sensitive: true,
      },
      {
        description: "AWS Bucket",
        label: "AWS Bucket",
        name: "aws_bucket",
        required: true,
        sensitive: true,
      },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  supportedDownloadSettings = [Hub.ActionDownloadSettings.Url]

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
        throw "No attached json."
    }

    if (!(request.formParams.api_key)) {
        throw "Missing API key"
    }

    if (!( request.formParams.url)) {
        throw "Missing Google sheets URL"
    }

    /*
    if (!(request.formParams.token)) {
        throw "Missing Google Sheets Access Token"
    }*/

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }

    let response

    const awsKey = JSON.stringify(request.params.aws_access_key)
    const awsSecret = JSON.stringify(request.params.aws_secret_key)
    //  const bucket = JSON.stringify(request.params.aws_bucket)

    const newAwsKey = awsKey.replace(/['"]+/g, "")
    const newSecretKey = awsSecret.replace(/['"]+/g, "")
    const newBucket = s3bucket.replace(/['"]+/g, "")

    // winston.info(JSON.stringify(request.params.kloudio_api_url))
    winston.info(JSON.stringify(request.params.aws_access_key))
    winston.info(JSON.stringify(request.params.aws_secret_key))
    winston.info(JSON.stringify(request.params.aws_bucket))
   // winston.info(JSON.stringify(request.stream))

    winston.info(request.formParams.api_key)
    winston.info(request.formParams.url)
    // winston.info(request.formParams.token)
    winston.info(typeof request.attachment.dataJSON)
    // winston.info(JSON.stringify(request.attachment.dataJSON.data))

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
        const anonymousId = this.generateAnonymousId()
        winston.info("uuid is" + anonymousId)
        AWS.config.update({ accessKeyId: request.params.aws_access_key, secretAccessKey:
            request.params.aws_secret_key })
        const s3Response = await uploadToS3("s3_filename", dataRows, newBucket, newAwsKey,
     newSecretKey)
        winston.info("after uploading the file to s3...", s3Response)
        data = {api_key: request.formParams.api_key, gsheetUrl: request.formParams.url,
            s3Uploaded: s3Bool, data: "s3_filename"}
    } else {
        data = {api_key: request.formParams.api_key, gsheetUrl: request.formParams.url,
            s3Uploaded: s3Bool, data: dataRows}
    }

    try {
        // const uri = JSON.stringify(request.params.kloudio_api_url)
        const newUri = API_URL.replace(/['"]+/g, "")
        winston.info("uri is:" + API_URL)
        winston.info("new uri is:" + newUri)
       // console.log("uri is:" + uri);
        response = await https.post({
        url: newUri,
        headers: {"Content-Type": "application/json"},
        json: true,
        body: data,
         }).catch((_err) => { winston.error(_err.toString()) })
    } catch (e) {
      response = { success: false, message: e.message }
    }
    winston.info(response)
    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "API Key",
      name: "api_key",
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

async function uploadToS3(file: string, s3Data: any, bucket: any, awsKey: any, awsSecret: any) {
    try {
      AWS.config.update({ accessKeyId: awsKey, secretAccessKey: awsSecret})
      AWS.config.region = "us-west-2"
      const s3 = new AWS.S3({ apiVersion: "2006-03-01" })
      return new Promise<any>( async (resolve, reject) => {
        winston.info("Inside uploadToS3 fn..")
        const uploadParams = { Bucket: bucket,
        Key: "", Body: JSON.stringify(s3Data),
        ContentType: "application/json" }
        winston.info("file" + file)
        winston.info("upload params " + uploadParams)
        uploadParams.Key = file
        winston.info("Before uploading the file to s3..." + uploadParams.Key)
        try {
            const s3Response = await s3.upload(uploadParams).promise()
            winston.info(`File uploaded to S3 at ${s3Response.Bucket} bucket. File location: ${s3Response.Location}`)
            return resolve(s3Response.Location)
          } catch (error) {
            return reject(error)
          }
    })} finally {
        winston.info("file" + file)
    }
}

async function parseData(lookerData: any, names: any, labels: any) {
    // const rowA: any[][] = []
    // const dataN = JSON.parse(data)
    const dataLen = lookerData.length
    const rowL = names.length
    winston.info("length of data is " +  dataLen)
    winston.info("length of row is " +  rowL)
    // winston.info("data after parsing is" + data)
    // tslint:disable-next-line: forin
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

Hub.addAction(new KloudioAction())
