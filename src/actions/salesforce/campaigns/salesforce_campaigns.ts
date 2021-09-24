import * as semver from "semver"
import * as winston from "winston"
import * as Hub from "../../../hub"
import { SalesforceOauthHelper } from "../common/oauth_helper"
import { SalesforceCampaignsFormBuilder } from "./campaigns_form_builder"
import { SalesforceCampaignsSendData } from "./campaigns_send_data"

export const AUTHORIZE_URL =
  "https://login.salesforce.com/services/oauth2/authorize"
export const REDIRECT_URL = `${process.env.ACTION_HUB_BASE_URL}/actions/salesforce_campaigns/oauth_redirect`
export const MAX_RESULTS = 10000 // how many existing campaigns to retrieve to append members to
export const CHUNK_SIZE = 200 // number of records to send at once
const TAGS = ["sfdc_contact_id", "sfdc_lead_id"]

export interface Tokens {
  access_token?: string
  refresh_token?: string
}

export class SalesforceCampaignsAction extends Hub.OAuthAction {
  readonly salesforceOauthHelper: SalesforceOauthHelper
  readonly salesforceCampaignsFormBuilder: SalesforceCampaignsFormBuilder
  readonly salesforceCampaignsSendData: SalesforceCampaignsSendData

  name = "salesforce_campaigns"
  label = "Salesforce Campaigns"
  iconName = "salesforce/common/salesforce.png"
  description = "Add contacts or leads to Salesforce campaign."
  params = [
    {
      description:
        "Salesforce domain name, e.g. https://MyDomainName.my.salesforce.com",
      label: "Salesforce domain",
      name: "salesforce_domain",
      required: true,
      sensitive: false,
    },
    {
      description: "Client ID for Salesforce Connected App",
      label: "Salesforce Connected App Consumer Key",
      name: "salesforce_client_id",
      required: true,
      sensitive: false,
    },
    {
      description: "Client Secret for Salesforce Connected App",
      label: "Salesforce Connected App Consumer Secret",
      name: "salesforce_client_secret",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  requiredFields = [{ any_tag: TAGS }]
  supportedVisualizationFormattings = [
    Hub.ActionVisualizationFormatting.Noapply,
  ]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  usesOauth = true
  // todo support All Results vs Results in Table
  // todo stream results

  /******** Constructor & Helpers ********/

  constructor() {
    super()
    this.salesforceOauthHelper = new SalesforceOauthHelper()
    this.salesforceCampaignsFormBuilder = new SalesforceCampaignsFormBuilder()
    this.salesforceCampaignsSendData = new SalesforceCampaignsSendData()
  }

  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream]
    } else {
      return [Hub.ActionFormat.JsonDetail]
    }
  }

  /******** OAuth Endpoints ********/

  async oauthUrl(redirectUri: string, encryptedState: string) {
    return this.salesforceOauthHelper.oauthUrl(redirectUri, encryptedState)
  }

  async oauthFetchInfo(
    urlParams: { [key: string]: string },
    redirectUri: string,
  ) {
    return this.salesforceOauthHelper.oauthFetchInfo(urlParams, redirectUri)
  }

  async oauthCheck(_request: Hub.ActionRequest) {
    // This part of Hub.OAuthAction is deprecated and unused
    return true
  }

  /******** Action Endpoints ********/

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "No attached json."
    }

    if (!(request.formParams.campaign_name && request.formParams.member_type)) {
      throw "Missing Salesforce campaign name or member type."
    }

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }

    if (!request.params.state_json) {
      throw "Request is missing state_json"
    }

    const fields: any[] = [].concat(
      ...Object.keys(qr.fields).map((k) => qr.fields[k]),
    )

    const identifiableFields = fields.filter(
      (f: any) => f.tags && f.tags.some((t: string) => TAGS.includes(t)),
    )

    // todo if no tags, search field names for match as backup, if nothing, then throw error

    if (identifiableFields.length !== 1) {
      throw `Query requires 1 field tagged with: ${TAGS.join(" or ")}.`
    }

    const memberIds = qr.data.map(
      (row: any) => row[identifiableFields[0].name].value,
    )

    let response: any = {}
    let tokens: Tokens

    try {
      const stateJson = JSON.parse(request.params.state_json)
      if (stateJson.access_token && stateJson.refresh_token) {
        tokens = stateJson
      } else {
        tokens = await this.salesforceOauthHelper.getAccessTokensFromAuthCode(
          request,
          stateJson,
        )
      }

      tokens = await this.salesforceCampaignsSendData.sendData(
        request,
        memberIds,
        tokens,
      )

      response.state = new Hub.ActionState()
      response.state.data = JSON.stringify(tokens)
    } catch (e) {
      response = { success: false, message: e.message }
    }
    return new Hub.ActionResponse(response)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()

    // uncomment the below to force a state reset and redo oauth login
    // if (request.params.state_json) {
    //   form.state = new Hub.ActionState();
    //   form.state.data = "reset";
    //   return form;
    // }

    let tokens: Tokens
    let fields: Hub.ActionFormField[]

    // state_json can be any of the four:
    //    1. first time user, an empty state: {},
    //    2. resetting state: 'reset'
    //    3. has auth code and redirect: {code: x, redirect, y}
    //    4. has access tokens:  {access_token: a, refresh_token: b}
    // scenarios 1 and 2 will show loginForm, 3 and 4 will show formBuilder
    if (request.params.state_json) {
      try {
        const stateJson = JSON.parse(request.params.state_json)
        if (stateJson.access_token && stateJson.refresh_token) {
          tokens = stateJson
        } else {
          tokens = await this.salesforceOauthHelper.getAccessTokensFromAuthCode(
            request,
            stateJson,
          )

          form.state = new Hub.ActionState()
          form.state.data = JSON.stringify(tokens)
        }

        ({ fields, tokens } =
          await this.salesforceCampaignsFormBuilder.formBuilder(
            request,
            tokens,
          ))
        form.fields = fields
        form.state = new Hub.ActionState()
        form.state.data = JSON.stringify(tokens)

        return form
      } catch (e) {
        winston.debug(e.toString())
      }
    }

    const loginForm = await this.salesforceOauthHelper.makeLoginForm(request)
    return loginForm
  }
}

Hub.addAction(new SalesforceCampaignsAction())
