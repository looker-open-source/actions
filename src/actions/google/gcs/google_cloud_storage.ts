import * as winston from "winston"
import { HTTP_ERROR } from "../../../error_types/http_errors"
import { getHttpErrorType } from "../../../error_types/utils"
import * as Hub from "../../../hub"
import { Error, errorWith } from "../../../hub/action_response"
const { Storage } = require("@google-cloud/storage")

const FILE_EXTENSION = new RegExp(/(.*)\.(.*)$/)
const LOG_PREFIX = "[Google Cloud Storage]"

export class GoogleCloudStorageAction extends Hub.Action {

  name = "google_cloud_storage"
  label = "Google Cloud Storage"
  iconName = "google/gcs/google_cloud_storage.svg"
  description = "Write data files to a Google Cloud Storage bucket."
  supportedActionTypes = [Hub.ActionType.Dashboard, Hub.ActionType.Query]
  usesStreaming = true
  requiredFields = []
  params = [
    {
      name: "client_email",
      label: "Client Email",
      required: true,
      sensitive: false,
      description: "Your client email for GCS from https://console.cloud.google.com/apis/credentials",
    }, {
      name: "private_key",
      label: "Private Key",
      required: true,
      sensitive: true,
      description: "Your private key for GCS from https://console.cloud.google.com/apis/credentials",
    }, {
      name: "project_id",
      label: "Project Id",
      required: true,
      sensitive: false,
      description: "The Project Id for your GCS project from https://console.cloud.google.com/apis/credentials",
    },
  ]

  async execute(request: Hub.ActionRequest) {
    const response = new Hub.ActionResponse()

    // The manual override takes precedence over the bucket selected from the dropdown. This allows
    // writing to a bucket in another project (e.g. a partner bucket) where the service account only
    // has object-level access (storage.objects.create) and cannot list buckets at the project level.
    const bucket = request.formParams.bucket_override?.trim() || request.formParams.bucket

    if (!bucket) {
      const error: Error = errorWith(
        HTTP_ERROR.bad_request,
        `${LOG_PREFIX} needs a GCS bucket specified.`,
      )
      response.success = false
      response.error = error
      response.message = error.message
      response.webhookId = request.webhookId

      winston.error(`${error.message}`, {error, webhookId: request.webhookId})
      return response
    }

    let filename = request.formParams.filename || request.suggestedFilename()

    // Substitute UTC date/time tokens anywhere in the filename. Tokens are case-sensitive:
    // {MM} is month while {mm} is minutes (moment.js convention). Since GCS object names may
    // contain "/", this enables date-partitioned "folders". Done before the Overwrite timestamp
    // logic below so a token-based name can still be made unique.
    const now = new Date()
    const tokens: { [k: string]: string } = {
      YYYY: `${now.getUTCFullYear()}`,
      YY: `${now.getUTCFullYear()}`.slice(-2),
      MM: String(now.getUTCMonth() + 1).padStart(2, "0"),
      DD: String(now.getUTCDate()).padStart(2, "0"),
      HH: String(now.getUTCHours()).padStart(2, "0"),
      mm: String(now.getUTCMinutes()).padStart(2, "0"),
      ss: String(now.getUTCSeconds()).padStart(2, "0"),
    }
    tokens.YYYYMMDD = tokens.YYYY + tokens.MM + tokens.DD
    filename = filename.replace(
      /\{(YYYYMMDD|YYYY|YY|MM|DD|HH|mm|ss)\}/g, (_m: string, t: string) => tokens[t])

    // If the overwrite formParam exists and it is "no" - ensure a timestamp is appended
    if (request.formParams.overwrite && request.formParams.overwrite === "no") {
      const captures = filename.match(FILE_EXTENSION)
      if (captures && captures.length > 1) {
        filename = captures[1] + `_${Date.now()}.` + captures[2]
      } else {
        filename += `_${Date.now()}`
      }
    }

    if (!filename) {
      const error: Error = errorWith(
        HTTP_ERROR.bad_request,
        `${LOG_PREFIX} request did not contain filename, or invalid filename was provided.`,
      )
      response.success = false
      response.error = error
      response.message = error.message
      response.webhookId = request.webhookId

      winston.error(`${error.message}`, {error, webhookId: request.webhookId})
      return response
    }

    const gcs = this.gcsClientFromRequest(request)
    const file = gcs.bucket(bucket)
      .file(filename)
    const writeStream = file.createWriteStream({
      metadata: {
        contentType: request.attachment?.mime ?? "application/octet-stream",
      },
    })

    try {
      await request.stream(async (readable) => {
        return new Promise<any>((resolve, reject) => {
          readable.pipe(writeStream)
            .on("error", (error: any) => {
              winston.error(`${LOG_PREFIX} Stream error: ${error.message}`, {error, webhookId: request.webhookId})
              writeStream.end() // Ensure stream is closed after an error
              reject(error)
            })
            .on("finish", resolve)
        })
      })
      return new Hub.ActionResponse({ success: true })
    } catch (e: any) {
      const errorType = getHttpErrorType(e, this.name)

      const error: Error = errorWith(
        errorType,
        `${LOG_PREFIX} ${e.message}`,
      )

      response.success = false
      response.error = error
      response.message = error.message
      response.webhookId = request.webhookId

      winston.error(
        `${LOG_PREFIX} Error uploading file. Error: ${error.message}`, {
          error,
          webhookId: request.webhookId,
        })
      return response
    }

  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    const gcs = this.gcsClientFromRequest(request)
    let results: any

    // Listing buckets requires storage.buckets.list at the PROJECT level, which a service account
    // delivering to a third-party/cross-project bucket may not have. Treat a listing failure (or an
    // empty list) as non-fatal: render the form with an empty dropdown so the user can still type a
    // bucket name into the manual override field below.
    try {
      results = await gcs.getBuckets()
    } catch (e: any) {
      winston.warn(
        `${LOG_PREFIX} Could not list buckets; rendering form with manual bucket entry only.` +
        ` Google SDK Error: ${e.message}`,
        {webhookId: request.webhookId},
      )
    }

    const buckets = (results && results[0]) ? results[0] : []

    const bucketField: any = {
      label: "Bucket",
      name: "bucket",
      required: false,
      options: buckets.map((b: any) => {
          return {name: b.id, label: b.name}
        }),
      type: "select",
      description: "Buckets visible to the service account in its configured project." +
        " Leave blank and use the manual override below to write to a bucket in another project.",
    }
    if (buckets.length > 0) {
      bucketField.default = buckets[0].id
    }

    form.fields = [bucketField, {
      label: "Bucket name (manual override)",
      name: "bucket_override",
      type: "string",
      description: "Optional. Exact GCS bucket name to write to; takes precedence over the dropdown." +
        " Use this for cross-project delivery where the service account only has" +
        " storage.objects.create on the target bucket and cannot list buckets.",
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
      description: "Optional. Supports UTC tokens, combinable with any separators:" +
        " {YYYYMMDD}, {YYYY}, {YY}, {MM} (month), {DD}, {HH}, {mm} (minutes), {ss}." +
        " Note {MM} is month and {mm} is minutes (case-sensitive)." +
        " GCS object names may contain \"/\", so you can date-partition into folders," +
        " e.g. \"daily/report_{YYYYMMDD}.csv\" becomes \"daily/report_20260617.csv\".",
    }, {
      label: "Overwrite",
      name: "overwrite",
      options: [{label: "Yes", name: "yes"}, {label: "No", name: "no"}],
      default: "yes",
      description: "If Overwrite is enabled, will use the title or filename and overwrite existing data." +
        " If disabled, a date time will be appended to the name to make the file unique.",
    }]

    return form
  }

  private gcsClientFromRequest(request: Hub.ActionRequest) {
    const credentials = {
      client_email: request.params.client_email,
      private_key: request.params.private_key!.replace(/\\n/g, "\n"),
    }

    return new Storage({
      projectId: request.params.project_id,
      credentials,
      apiEndpoint: "https://storage.googleapis.com",
      useAuthWithCustomEndpoint : true,
    })
  }

}

Hub.addAction(new GoogleCloudStorageAction())
