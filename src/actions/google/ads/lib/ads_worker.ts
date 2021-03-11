import * as gaxios from "gaxios"
import { Credentials } from "google-auth-library"
import * as Hub from "../../../../hub"
import { MissingAuthError } from "../../common/missing_auth_error"
import { MissingRequiredParamsError } from "../../common/missing_required_params_error"
import { safeParseJson } from "../../common/utils"
import { GoogleAdsCustomerMatch } from "../customer_match"
import { GoogleAdsUserListUploader } from "./data_uploader"

const CREATE_LIST_OPTION = "Create new list..."

interface AdsUserState {
  tokens: Credentials
  redirect: string
}

export class GoogleAdsActionWorker {

  static async fromHub(hubRequest: Hub.ActionRequest, action: GoogleAdsCustomerMatch) {
    const req = new GoogleAdsActionWorker(hubRequest, action)
    await req.checkTokens()
    return req
  }

  webhookId?: string
  clientCid: string
  userState: AdsUserState
  formParams: any
  offlineUserDataJobResourceName?: string

  get accessToken() {
    return this.userState.tokens.access_token
  }

  get isCreateUserList() {
    return this.userListResourceName === CREATE_LIST_OPTION
  }

  get userListResourceName() {
    return this.formParams.userListResourceName
  }

  set userListResourceName(newval: string) {
    this.formParams.userListResourceName = newval
  }

  get doHashing() {
    return this.formParams.doHashing === "yes"
  }

  constructor(readonly hubRequest: Hub.ActionRequest, readonly actionInstance: GoogleAdsCustomerMatch) {
    const cid = hubRequest.params.clientCid
    const state = safeParseJson(hubRequest.params.state_json)

    if (!cid) {
      throw new MissingRequiredParamsError("Client Account ID not provided; check the action configuration page.")
    }

    if (!state || !state.tokens || !state.tokens.access_token || !state.tokens.refresh_token || !state.redirect) {
      throw new MissingAuthError("User state was missing or did not contain oauth tokens & redirect")
    }

    this.clientCid = cid
    this.userState = state
    this.formParams = hubRequest.formParams
    this.webhookId = hubRequest.webhookId
  }

  log(level: string, ...rest: any[]) {
    return this.actionInstance.log(level, ...rest)
  }

  async checkTokens() {
    if ( this.userState.tokens.expiry_date == null || this.userState.tokens.expiry_date < Date.now() ) {
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

  async getOrCreateUserList() {
    if (this.isCreateUserList) {
      return this.createUserList()
    }
    if (!this.userListResourceName) {
      throw new MissingRequiredParamsError("List resource name is missing or could not be created")
    }
    this.log("info", "Using existing user list:", this.userListResourceName)
  }

  async createUserList() {
    const {newListName, newListDescription} = this.formParams
    if (!newListName) {
      throw new MissingRequiredParamsError("Name for new list is missing")
    }

    const method = "POST"
    const path = `customers/${this.clientCid}/userLists:mutate`
    const body = {
      customer_id: this.clientCid,
      operations: [
        {
          create: {
            name: newListName,
            description: newListDescription,
            membership_status: "OPEN",
            membership_life_span: 10000,
            crm_based_user_list: {
              upload_key_type: "CONTACT_INFO",
              data_source_type: "FIRST_PARTY",
            },
          },
        },
      ],
      validate_only: false,
    }

    const createListResp = await this.apiCall(method, path, body)
    this.userListResourceName = createListResp.results[0].resourceName
    this.log("info", "Created user list: ", this.userListResourceName)
    return createListResp
  }

  async createDataJob() {
    const method = "POST"
    const path = `customers/${this.clientCid}/offlineUserDataJobs:create`
    const body = {
      customer_id: this.clientCid,
      job: {
        external_id: Date.now(), // must be an Int64 so not very useful
        type: "CUSTOMER_MATCH_USER_LIST",
        customer_match_user_list_metadata: {
          user_list: this.userListResourceName,
        },
      },
    }

    const createJobResp = await this.apiCall(method, path, body)
    this.offlineUserDataJobResourceName = createJobResp.resourceName
    this.log("info", "Created data job:", this.offlineUserDataJobResourceName)
    return createJobResp
  }

  async uploadData() {
    const dataUploader = new GoogleAdsUserListUploader(this)
    this.log("info", "Beginning data upload. Do hashing =", this.doHashing.toString())
    return dataUploader.run()
  }

  async addDataJobOperations(userIdentifiers: any[]) {
    const method = "POST"
    const path = `${this.offlineUserDataJobResourceName}:addOperations`
    const body = {
      resource_name: this.offlineUserDataJobResourceName,
      enable_partial_failure: true,
      operations: [{
        create: {
          user_identifiers: userIdentifiers,
        },
      }],
    }

    return this.apiCall(method, path, body)
  }

  async runJob() {
    const method = "POST"
    const path = `${this.offlineUserDataJobResourceName}:run`
    const body = {
      resource_name: this.offlineUserDataJobResourceName,
    }

    return this.apiCall(method, path, body)
  }

  async getJob() {
    const method = "GET"
    const path = this.offlineUserDataJobResourceName

    if (path === undefined) {
      throw new MissingRequiredParamsError("Job resource name is not present.")
    }

    return this.apiCall(method, path)
  }

  async makeForm() {
    return this.isCreateUserList
      ? this.makeCreateListForm()
      : await this.makeSelectListForm()
  }

  async makeSelectListForm() {
    const form = new Hub.ActionForm()
    const method = "POST"
    const path = `customers/${this.clientCid}/googleAds:searchStream`
    const body = {
      query:
        "SELECT user_list.id, user_list.name"
        + " FROM user_list"
        + " WHERE user_list.type = 'CRM_BASED'"
        + " AND user_list.read_only = FALSE"
        + " AND user_list.account_user_list_status = 'ENABLED'"
        + " AND user_list.membership_status = 'OPEN'",
    }
    const userLists = await this.apiCall(method, path, body)
    const userListResults = userLists.length ? userLists[0].results : []

    const makeSelectOption = (i: any) => {
      return {
        name: i.userList.resourceName,
        label: i.userList.name,
      }
    }

    const selectOptions = userListResults.map(makeSelectOption)
    selectOptions.unshift({name: CREATE_LIST_OPTION, label: CREATE_LIST_OPTION})

    form.fields.push({
      name: "userListResourceName",
      label: "User List to Populate",
      description:
          "User List to update."
        + " Showing CRM-based lists that are open for updating."
        + " You can also create a new list.",
      type: "select",
      options: selectOptions,
      default: (this.formParams.userListResourceName ? this.formParams.userListResourceName : ""),
      interactive: true,
      required: true,
    })
    form.fields.push(this.doHashingFormField() as Hub.ActionFormField)

    return form
  }

  makeCreateListForm() {
    const form = new Hub.ActionForm()
    form.fields.push({
      name: "userListResourceName",
      label: "User List",
      description: "You are currently creating a new list. Select \"Reset\" to go back.",
      type: "select",
      options: [
        {name: CREATE_LIST_OPTION, label: CREATE_LIST_OPTION},
        {name: "reset", label: "Reset"},
      ],
      default: CREATE_LIST_OPTION,
      interactive: true,
      required: false,
    })
    form.fields.push({
      name: "newListName",
      label: "New List Name",
      type: "string",
      description: "Name of the new user list",
      default: "",
      required: true,
    })
    form.fields.push({
      name: "newListDescription",
      label: "Description",
      type: "string",
      description: "Description of the new user list",
      default: "",
      required: false,
    })
    form.fields.push(this.doHashingFormField() as Hub.ActionFormField)
    return form
  }

  doHashingFormField() {
    return {
      name: "doHashing",
      label: "Should the Data be Hashed First?",
      type: "select",
      description: "All personal data must be normalized and hashed before uploading to Google Ads."
        + " If your data is not yet hashed, select 'yes' and Looker will attempt to hash the data"
        + " according to Google Ads' requirements."
        + " If 'no' then the data will be sent as-is. This means the report data should already be normalized and"
        + " hashed inside your database."
        + " Note that if the data is not hashed correctly, your customer list will not match any audiences.",
      options: [
        {name: "yes", label: "Yes"},
        {name: "no", label: "No"},
      ],
      default: "yes",
      required: true,
    }
  }

  async apiCall(method: "GET" | "POST", url: string, data?: any) {
    const response = await gaxios.request<any>({
      method,
      url,
      data,
      baseURL: "https://googleads.googleapis.com/v5/",
      headers:  {
        "developer-token": this.actionInstance.developerToken,
        "login-customer-id": this.actionInstance.managerCid,
        "Authorization": `Bearer ${this.accessToken}`,
      },
    })

    return response.data
  }

}
