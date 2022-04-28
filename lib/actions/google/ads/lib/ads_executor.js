"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
        this.offlineUserDataJobResourceName = ""; // will be updated later
        this.targetUserListRN = adsRequest.formParams.targetUserListRN;
    }
    createUserList(newListName, newListDescription) {
        return __awaiter(this, void 0, void 0, function* () {
            const createListResp = yield this.apiClient.createUserList(this.targetCid, newListName, newListDescription, this.uploadKeyType, this.mobileAppId);
            this.targetUserListRN = createListResp.results[0].resourceName;
            this.log("info", "Created user list: ", this.targetUserListRN);
            return;
        });
    }
    createDataJob() {
        return __awaiter(this, void 0, void 0, function* () {
            const createJobResp = yield this.apiClient.createDataJob(this.targetCid, this.targetUserListRN);
            this.offlineUserDataJobResourceName = createJobResp.resourceName;
            this.log("info", "Created data job:", this.offlineUserDataJobResourceName);
            return createJobResp;
        });
    }
    uploadData() {
        return __awaiter(this, void 0, void 0, function* () {
            const dataUploader = new data_uploader_1.GoogleAdsUserListUploader(this);
            this.log("info", "Beginning data upload. Do hashing =", this.adsRequest.doHashingBool.toString());
            return dataUploader.run();
        });
    }
    addDataJobOperations(userIdentifiers) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.apiClient.addDataJobOperations(this.offlineUserDataJobResourceName, userIdentifiers);
        });
    }
    runJob() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.apiClient.runJob(this.offlineUserDataJobResourceName);
        });
    }
}
exports.GoogleAdsActionExecutor = GoogleAdsActionExecutor;
