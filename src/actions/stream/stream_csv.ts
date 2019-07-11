import * as Hub from "../../hub"

import * as winston from "winston"

export class StreamCsvAction extends Hub.Action {

  name = "stream_csv"
  label = "Stream CSV"
  iconName = "google/google_cloud_storage.svg"
  description = "Stream CSV."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Formatted]
  usesStreaming = true
  requiredFields = []
  params = []

  async execute(request: Hub.ActionRequest) {
    winston.info(`request: ${JSON.stringify(request)}`)

    let data = Buffer.from("")

    await request.stream(async (readable) => {
      return new Promise<any>((resolve, reject) => {
        readable
          .on("data", (chunk: any) => {
            data = Buffer.concat([data, chunk])
          })
          .on("finish", () => {
            winston.info(`buffer: ${data}`)
            resolve()
          })
          .on("error", reject)
      })
    })

    return new Hub.ActionResponse({ success: true })

  }

}

Hub.addAction(new StreamCsvAction())
