import * as AWS from "aws-sdk"
import * as https from "request-promise-native"
import * as winston from "winston"
import * as Hub from "../../hub"

export class KloudioAction extends Hub.Action {

  name = "kloudio"
  label = "Kloudio"
  iconName = "kloudio/kloudio.svg"
  description = "Add records to a Google Spreadsheet."
  // usesStreaming = true
  params = [
    {
      description: "API URL for Kloudio from account page",
      label: "Kloudio API URL",
      name: "kloudio_api_url",
      required: true,
      sensitive: true,
    },
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

    // const qr = request.attachment.dataJSON
    /*if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }*/

    let response
    //  const sizeof = require("object-sizeof")
    // const size = sizeof(request.attachment.dataJSON)
    // info: "JSON.stringify(request.attachment.dataJSON)"

    const awsKey = JSON.stringify(request.params.aws_access_key)
    const awsSecret = JSON.stringify(request.params.aws_secret_key)
    const bucket = JSON.stringify(request.params.aws_bucket)

    const newAwsKey = awsKey.replace(/['"]+/g, "")
    const newSecretKey = awsSecret.replace(/['"]+/g, "")
    const newBucket = bucket.replace(/['"]+/g, "")

    winston.info(JSON.stringify(request.params.kloudio_api_url))
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
    const labelIds = request.attachment.dataJSON.fields.dimensions.map((labelId: { name: any; }) => labelId.name)
    winston.info(labelIds[0])
    const dataRows = parseData(JSON.stringify(request.attachment.dataJSON.data), labelIds)
    winston.info("length of row data is " + JSON.stringify(dataRows))
    //
    AWS.config.update({ accessKeyId: request.params.aws_access_key, secretAccessKey: request.params.aws_secret_key })
    const s3Response = await uploadToS3("s3_filename", request.attachment.dataJSON, newBucket, newAwsKey,
     newSecretKey)
    const data = {api_key: request.formParams.api_key, url: request.formParams.url,
            s3_url: s3Response.Location, info: request.attachment.dataJSON}
    winston.info("after uploading the file to s3...", s3Response)
    try {
        const uri = JSON.stringify(request.params.kloudio_api_url)
        const newUri = uri.replace(/['"]+/g, "")
        winston.info("uri is:" + uri)
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

}

async function uploadToS3(file: string, data: any, bucket: any, awsKey: any, awsSecret: any) {
    try {
      AWS.config.update({ accessKeyId: awsKey, secretAccessKey: awsSecret})
      AWS.config.region = "us-west-2"
      const s3 = new AWS.S3({ apiVersion: "2006-03-01" })
      return new Promise<any>( async (resolve, reject) => {
        winston.info("Inside uploadToS3 fn..")
        const uploadParams = { Bucket: bucket,
        Key: "", Body: JSON.stringify(data),
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

function parseData(data: any, labels: any) {
    const row = []
    const dataLen = data.length
    const rowL = labels.length
    winston.info("length of data is " +  dataLen)
    winston.info("length of row is " +  rowL)

    // tslint:disable-next-line: forin
    for (let i = 0; i < 5; i++) {
        if (data[i]) {
            winston.info(data[i])
            row.push(data[i])
        }
    }

    return row
}

Hub.addAction(new KloudioAction())
