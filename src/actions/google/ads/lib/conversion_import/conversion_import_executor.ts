import { GoogleAdsConversionImportUploader } from "./conversion_import_data_uploader"
import { GoogleAdsConversionImportActionRequest } from "./conversion_import_request"

export class GoogleAdsConversionImportActionExecutor {

  readonly apiClient = this.adsRequest.apiClient!
  readonly log = this.adsRequest.log
  readonly targetCid = this.adsRequest.targetCid

  constructor(readonly adsRequest: GoogleAdsConversionImportActionRequest) {
  }

  async uploadData() {
    this.log("info", "conversion_import_executor uploadData")
    const dataUploader = new GoogleAdsConversionImportUploader(this)
    return dataUploader.run()
  }

  async importOfflineConversion(conversions: any[]) {
    this.log("info", "importOfflineConversion before sending to apiclient" + JSON.stringify(conversions))
    return this.apiClient.uploadClickConversions(this.targetCid, conversions)
  }
}
