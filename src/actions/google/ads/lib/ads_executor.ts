import { GoogleAdsActionRequest } from "./ads_request"
import { GoogleAdsUserListUploader } from "./data_uploader"

export class GoogleAdsActionExecutor {

  readonly apiClient = this.adsRequest.apiClient!
  readonly log = this.adsRequest.log
  readonly targetCid = this.adsRequest.targetCid
  offlineUserDataJobResourceName: string
  targetUserListRN: string

  constructor(readonly adsRequest: GoogleAdsActionRequest) {
    this.offlineUserDataJobResourceName = "" // will be updated later
    this.targetUserListRN = adsRequest.formParams.targetUserListRN
  }

  async createUserList(newListName: string, newListDescription: string) {
    const createListResp = await this.apiClient.createUserList(this.targetCid, newListName, newListDescription)
    this.targetUserListRN = createListResp.results[0].resourceName
    this.log("info", "Created user list: ", this.targetUserListRN)
    return
  }

  async createDataJob() {
    const createJobResp = await this.apiClient.createDataJob(this.targetCid, this.targetUserListRN)
    this.offlineUserDataJobResourceName = createJobResp.resourceName
    this.log("info", "Created data job:", this.offlineUserDataJobResourceName)
    return createJobResp
  }

  async uploadData() {
    const dataUploader = new GoogleAdsUserListUploader(this)
    this.log("info", "Beginning data upload. Do hashing =", this.adsRequest.doHashingBool.toString())
    return dataUploader.run()
  }

  async addDataJobOperations(userIdentifiers: any[]) {
    return this.apiClient.addDataJobOperations(this.offlineUserDataJobResourceName, userIdentifiers)
  }

  async runJob() {
    return this.apiClient.runJob(this.offlineUserDataJobResourceName)
  }
}
