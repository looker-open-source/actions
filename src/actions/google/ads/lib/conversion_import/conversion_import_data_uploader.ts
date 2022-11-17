import * as oboe from "oboe"
import { Readable } from "stream"
import { GoogleAdsConversionImportActionExecutor } from "./conversion_import_executor"

const BATCH_SIZE = 2000

interface OutputCells {
  gclid?: string;
  conversionAction?: string;
  conversionDateTime?: string;
  conversionValue?: string;
  currencyCode?: string;
}

export class GoogleAdsConversionImportUploader {

  readonly adsRequest = this.adsExecutor.adsRequest
  readonly log = this.adsRequest.log
  private batchPromises: Promise<void>[] = []
  private batchQueue: any[] = []
  private currentRequest: Promise<any> | undefined
  private isSchemaDetermined = false
  private rowQueue: any[] = []
  private schema: { [s: string]: string } = {}

  private regexes = [
    [/gclid|google.*click.*id|click.*id/i, "gclid"],
    [/conversion.*name|name|conversion.*action|action/i, "conversionAction"],
    [/conversion.*date.*time|conversion.time|time|date.*time|date/i, "conversionDateTime"],
    [/conversion.*value|value/i, "conversionValue"],
    [/conversion.*currency|currency|currency.*code/i, "currencyCode"],
  ]

  constructor(readonly adsExecutor: GoogleAdsConversionImportActionExecutor) { }

  private get batchIsReady() {
    return this.rowQueue.length >= BATCH_SIZE
  }

  private get numBatches() {
    return this.batchPromises.length
  }

  async run() {
    try {
      // The ActionRequest.prototype.stream() method is going to await the callback we pass
      // and either resolve the result we return here, or reject with an error from anywhere
      await this.adsRequest.streamingDownload(async (downloadStream: Readable) => {
        return this.startAsyncParser(downloadStream)
      })
    } catch (errorReport) {
      // TODO: the oboe fail() handler sends an errorReport object, but that might not be the only thing we catch
      this.log("error", "Streaming parse failure toString:", errorReport.toString())
      this.log("error", "Streaming parse failure JSON:", JSON.stringify(errorReport))
    }
    await Promise.all(this.batchPromises)
    this.log("info",
      `Streaming upload complete. Sent ${this.numBatches} batches (batch size = ${BATCH_SIZE})`,
    )
  }

  private async startAsyncParser(downloadStream: Readable) {
    return new Promise<void>((resolve, reject) => {
      oboe(downloadStream)
        .node("!.*", (row: any) => {
          if (!this.isSchemaDetermined) {
            this.determineSchema(row)
          }
          this.handleRow(row)
          this.scheduleBatch()
          return oboe.drop
        })
        .done(() => {
          this.scheduleBatch(true)
          resolve()
        })
        .fail(reject)
    })
  }

  private determineSchema(row: any) {
    for (const columnLabel of Object.keys(row)) {
      for (const mapping of this.regexes) {
        const [regex, outputPath] = mapping
        if (columnLabel.match(regex)) {
          this.schema[columnLabel] = outputPath as string
        }
      }
    }
    this.isSchemaDetermined = true
  }

  private handleRow(row: any) {
    this.log("info",
      `handleRow before transform thomas - ${JSON.stringify(row)} )`,
    )
    const output = this.transformRow(row)
    this.log("info",
      `handleRow thomas - ${JSON.stringify(output)} )`,
    )
    this.rowQueue.push(output)
  }

  

  private transformRow(row: any) {
    const schemaMapping = Object.entries(this.schema)
    this.log("info",
      `transformRow thomas schema Mapping - ${JSON.stringify(schemaMapping)} )`,
    )
    const outputCells: OutputCells = {};
    schemaMapping.forEach(([columnLabel, outputPath]) => {
      const outputValue = row[columnLabel];
      if (!outputValue) {
        return;
      }
      outputCells[outputPath as keyof OutputCells] =  outputValue;
    })
    this.log("info",
      `transformRow thomas outputcells - ${JSON.stringify(outputCells)} )`,
    )

    return outputCells;
  }

  private scheduleBatch(force = false) {
    if (!this.batchIsReady && !force) {
      return
    }
    const batch = this.rowQueue.splice(0, BATCH_SIZE - 1)
    this.log("info",
      `schedule Batch thomas  - ${JSON.stringify(batch)} )`,
    )
    this.batchQueue.push(batch)
    this.batchPromises.push(this.sendBatch())
    this.log("debug", `Sent batch number: ${this.numBatches}`)
  }

  // The Ads API seems to generate a concurrent modification exception if we have multiple
  // addDataJobOperations requests in progress at one time. So we use this funky solution
  // to run one at a time, without having to refactor the streaming parser and everything too.
  private async sendBatch(): Promise<void> {
    if (this.currentRequest !== undefined || this.batchQueue.length === 0) {
      return
    }
    await this.adsRequest.checkTokens().then(async () => {
      const currentBatch = this.batchQueue.shift()
      this.log("info",
        `sendBatch thomas  - ${JSON.stringify(currentBatch)} )`,
      )
      this.currentRequest = this.adsExecutor.importOfflineConversion(currentBatch)
      await this.currentRequest
      this.currentRequest = undefined
      return this.sendBatch()
    })
  }
}
