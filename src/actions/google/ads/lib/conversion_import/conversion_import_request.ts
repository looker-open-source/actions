import { Credentials } from "google-auth-library"
import * as Hub from "../../../../../hub"
import { Logger } from "../../../common/logger"
import { MissingAuthError } from "../../../common/missing_auth_error"
import { MissingRequiredParamsError } from "../../../common/missing_required_params_error"
import { safeParseJson } from "../../../common/utils"
import { GoogleAdsConversionImport } from "../../conversion_import"
import { GoogleAdsApiClient } from "../api_client"
import { GoogleAdsConversionImportActionExecutor} from "./conversion_import_executor"
import { GoogleAdsConversionImportActionFormBuilder } from "./conversion_import_form_builder"

interface AdsUserState {
  tokens: Credentials
  redirect: string
}

export class GoogleAdsConversionImportActionRequest {

  static async fromHub(hubRequest: Hub.ActionRequest, action: GoogleAdsConversionImport, logger: Logger) {
    const adsReq = new GoogleAdsConversionImportActionRequest(hubRequest, action, logger)
    await adsReq.checkTokens()
    adsReq.setApiClient()
    return adsReq
  }

  readonly streamingDownload = this.hubRequest.stream.bind(this.hubRequest)
  apiClient?: GoogleAdsApiClient
  formParams: any
  userState: AdsUserState
  webhookId?: string

  constructor(
    readonly hubRequest: Hub.ActionRequest,
    readonly actionInstance: GoogleAdsConversionImport,
    readonly log: Logger,
  ) {
    const state = safeParseJson(hubRequest.params.state_json)

    if (!state || !state.tokens || !state.tokens.access_token || !state.tokens.refresh_token || !state.redirect) {
      throw new MissingAuthError("User state was missing or did not contain oauth tokens & redirect")
    }

    this.userState = state
    this.formParams = hubRequest.formParams
    this.webhookId = hubRequest.webhookId
  }

  async checkTokens() {
    // adding 5 minutes to expiry_date check to handle refresh edge case
    if ( this.userState.tokens.expiry_date == null || this.userState.tokens.expiry_date < (Date.now() + 5 * 60000) ) {
      this.log("debug", "Tokens appear expired; attempting refresh.")

      const data = await this.actionInstance.oauthHelper.refreshAccessToken(this.userState.tokens)

      if (!data || !data.access_token || !data.expiry_date) {
        throw new MissingAuthError("Could not refresh tokens")
      }

      this.userState.tokens.access_token = data.access_token
      this.userState.tokens.expiry_date  = data.expiry_date
      this.log("debug", "Set new tokens")
    }
  }

  setApiClient() {
    this.apiClient = new GoogleAdsApiClient(this.log, this.accessToken, this.developerToken, this.loginCid)
  }

  get accessToken() {
    return this.userState.tokens.access_token!
  }

  get developerToken() {
    return this.actionInstance.developerToken
  }

  get loginCid() {
    return this.formParams.loginCid
  }

  get targetCid() {
    return this.formParams.targetCid
  }

  async makeForm() {
    const formBuilder = new GoogleAdsConversionImportActionFormBuilder(this)
    return formBuilder.makeForm()
  }

  async execute() {

    // 0) Do execution specific validations
    if (!this.loginCid) {
      throw new MissingRequiredParamsError("Login account id is missing")
    }

    // 0) If a non-manager account was chosen for login, there will be no targetCid. Fill that in and start the helper.
    if (!this.targetCid) {
      this.formParams.targetCid = this.loginCid
    }
    const executor = new GoogleAdsConversionImportActionExecutor(this)

    // 3) Add the data ("user identifiers") to the job
    await executor.uploadData()

    return
  }
}
