"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsActionExecutor = void 0;
const data_uploader_1 = require("./data_uploader");
class GoogleAdsActionExecutor {
    constructor(adsRequest) {
        this.adsRequest = adsRequest;
        this.apiClient = this.adsRequest.apiClient;
        this.log = this.adsRequest.log;
        this.targetCid = this.adsRequest.targetCid;
        this.mobileAppId = this.adsRequest.mobileAppId;
        this.uploadKeyType = this.adsRequest.uploadKeyType;
        this.consentAdUserData = this.adsRequest.consentAdUserData;
        this.consentAdPersonalization = this.adsRequest.consentAdPersonalization;
        this.offlineUserDataJobResourceName = ""; // will be updated later
        this.targetUserListRN = adsRequest.formParams.targetUserListRN;
    }
    async createUserList(newListName, newListDescription) {
        const createListResp = await this.apiClient.createUserList(this.targetCid, newListName, newListDescription, this.uploadKeyType, this.mobileAppId);
        this.targetUserListRN = createListResp.results[0].resourceName;
        this.log("info", "Created user list: ", this.targetUserListRN);
        return;
    }
    async createDataJob() {
        const createJobResp = await this.apiClient.createDataJob(this.targetCid, this.targetUserListRN, this.consentAdUserData, this.consentAdPersonalization);
        this.offlineUserDataJobResourceName = createJobResp.resourceName;
        this.log("info", "Created data job:", this.offlineUserDataJobResourceName);
        return createJobResp;
    }
    async uploadData() {
        const dataUploader = new data_uploader_1.GoogleAdsUserListUploader(this);
        this.log("info", "Beginning data upload. Do hashing =", this.adsRequest.doHashingBool.toString());
        return dataUploader.run();
    }
    async addDataJobOperations(userIdentifiers) {
        return this.apiClient.addDataJobOperations(this.offlineUserDataJobResourceName, userIdentifiers);
    }
    async runJob() {
        return this.apiClient.runJob(this.offlineUserDataJobResourceName);
    }
}
exports.GoogleAdsActionExecutor = GoogleAdsActionExecutor;
