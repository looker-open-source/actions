import * as winston from "winston"
import { HTTP_ERROR } from "../../../error_types/http_errors"
import {formatErrorCode} from "../../../error_types/utils"
import * as Hub from "../../../hub"
import { Error } from "../../../hub/action_response"

const storage = require("@google-cloud/storage")

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

    if (!request.formParams.bucket) {
      const error: Error = {
        http_code: HTTP_ERROR.bad_request.code,
        status_code: HTTP_ERROR.bad_request.status,
        message: `${HTTP_ERROR.bad_request.description} ${LOG_PREFIX} needs a GCS bucket specified.`,
        location: "ActionContainer",
        documentation_url: "TODO",
      }
      response.success = false
      response.error = error
      response.message = error.message
      response.webhookId = request.webhookId

      winston.error(`${error.message}`, {error, webhookId: request.webhookId})
      return response
    }

    let filename = request.formParams.filename || request.suggestedFilename()

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
      const error: Error = {
        http_code: HTTP_ERROR.bad_request.code,
        status_code: HTTP_ERROR.bad_request.status,
        message: `${HTTP_ERROR.bad_request.description} ${LOG_PREFIX} request did not contain filename, or invalid filename was provided.`,
        location: "ActionContainer",
        documentation_url: "TODO",
      }
      response.success = false
      response.error = error
      response.message = error.message
      response.webhookId = request.webhookId

      winston.error(`${error.message}`, {error, webhookId: request.webhookId})
      return response
    }

    const gcs = this.gcsClientFromRequest(request)
    const file = gcs.bucket(request.formParams.bucket)
      .file(filename)
    const writeStream = file.createWriteStream()

    try {
      await request.stream(async (readable) => {
        return new Promise<any>((resolve, reject) => {
          readable.pipe(writeStream)
            .on("error", reject)
            .on("finish", resolve)
        })
      })
      return new Hub.ActionResponse({ success: true })
    } catch (e: any) {
      let error: Error = {
        http_code: HTTP_ERROR.internal.code,
        status_code: HTTP_ERROR.internal.status,
        message: `${HTTP_ERROR.internal.description} ${LOG_PREFIX}`,
        location: "GCS",
        documentation_url: "TODO",
      }

      if (e.code) {
        const formattedError = formatErrorCode(e.code)
        error = {
          ...error,
          http_code: formattedError.code,
          status_code: formattedError.status,
          message: `${formattedError.description} ${LOG_PREFIX} ${e.message}`,
        }
      }
      response.success = false
      response.error = error
      response.message = error.message
      response.webhookId = request.webhookId

      winston.error(`${error.message}`, {error, webhookId: request.webhookId})
      return response
    }

  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    const gcs = this.gcsClientFromRequest(request)
    let results: any

    try {
      results = await gcs.getBuckets()
    } catch (e: any) {
      form.error = `An error occurred while fetching the bucket list.

      Your Google Cloud Storage credentials may be incorrect.

      Google SDK Error: "${e.message}"`
      winston.error(
        `${LOG_PREFIX} An error occurred while fetching the bucket list. Google SDK Error: ${e.message} `,
        {webhookId: request.webhookId},
      )
      return form
    }

    if (!(results && results[0] && results[0][0])) {
      form.error = "No buckets in account."
      winston.error(`${LOG_PREFIX} No buckets in account`, {webhookId: request.webhookId})
      return form
    }

    const buckets = results[0]

    form.fields = [{
      label: "Bucket",
      name: "bucket",
      required: true,
      options: buckets.map((b: any) => {
          return {name: b.id, label: b.name}
        }),
      type: "select",
      default: buckets[0].id,
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
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
    const config = {
      projectId: request.params.project_id,
      credentials,
    }

    return new storage(config)
  }

}

Hub.addAction(new GoogleCloudStorageAction())
