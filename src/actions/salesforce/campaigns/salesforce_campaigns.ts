import * as winston from "winston"
import * as Hub from "../../../hub"
import { SalesforceOauthHelper } from "../common/oauth_helper"
import { SalesforceCampaignsFormBuilder } from "./campaigns_form_builder"
import { SalesforceCampaignsSendData } from "./campaigns_send_data"

export const REDIRECT_URL = `${process.env.ACTION_HUB_BASE_URL}/actions/salesforce_campaigns/oauth_redirect`
export const FIELD_MAPPING = [
  { sfdcMemberType: "ContactId", tag: "sfdc_contact_id", fallbackRegex: new RegExp("contact id", "i") },
  { sfdcMemberType: "LeadId", tag: "sfdc_lead_id", fallbackRegex: new RegExp("lead id", "i") },
]
const TAGS = FIELD_MAPPING.map((fm) => fm.tag)

export interface Tokens {
  access_token?: string
  refresh_token?: string
}

export interface Mapper {
  fieldname: string
  sfdcMemberType: string
}

export interface MemberIds extends Mapper {
  data: string[]
}

export class SalesforceCampaignsAction extends Hub.OAuthAction {
  readonly sfdcOauthHelper: SalesforceOauthHelper
  readonly sfdcCampaignsFormBuilder: SalesforceCampaignsFormBuilder
  readonly sfdcCampaignsSendData: SalesforceCampaignsSendData

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
      user_attribute_name: "salesforce_campaigns_action_domain",
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  requiredFields = [{ any_tag: TAGS }]
  supportedFormats = [Hub.ActionFormat.JsonDetailLiteStream]
  supportedDownloadSettings = [Hub.ActionDownloadSettings.Push]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  usesOauth = true
  minimumSupportedLookerVersion = "22.6.0"
  // TODO: support All Results vs Results in Table
  // TODO: stream results

  /******** Constructor & Helpers ********/

  constructor(oauthClientId: string, oauthClientSecret: string, maxResults: number, chunkSize: number) {
    super()
    this.sfdcOauthHelper = new SalesforceOauthHelper(oauthClientId, oauthClientSecret)
    this.sfdcCampaignsFormBuilder = new SalesforceCampaignsFormBuilder(oauthClientId, oauthClientSecret, maxResults)
    this.sfdcCampaignsSendData = new SalesforceCampaignsSendData(oauthClientId, oauthClientSecret, chunkSize)
  }

  /******** OAuth Endpoints ********/

  async oauthUrl(redirectUri: string, encryptedState: string) {
    return this.sfdcOauthHelper.oauthUrl(redirectUri, encryptedState)
  }

  async oauthFetchInfo(
    urlParams: { [key: string]: string },
    redirectUri: string,
  ) {
    return this.sfdcOauthHelper.oauthFetchInfo(urlParams, redirectUri)
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

    if (!(request.formParams.campaign_name)) {
      throw "Missing Salesforce campaign name."
    }

    const dataJSON = request.attachment.dataJSON
    if (!dataJSON.fields || !dataJSON.data) {
      throw "Request payload is an invalid format."
    }

    if (!request.params.state_json) {
      throw "Request is missing state_json."
    }

    const fields: any[] = [].concat(
      ...Object.keys(dataJSON.fields).map((k) => dataJSON.fields[k]),
    )

    const mapper: Mapper[] = []

    // first try to match fields by tag
    fields.filter((f) =>
        f.tags && f.tags.some((t: string) =>
          TAGS.map((tag) => {
            if (tag === t) {
              mapper.push({
                fieldname: f.name,
                sfdcMemberType: FIELD_MAPPING.filter((fm) => fm.tag === t)[0].sfdcMemberType,
              })
            }
          }),
        ),
    )

    if (mapper.length < fields.length) {
      winston.debug(`${mapper.length} out of ${fields.length} fields matched with tags, attemping regex`)

      fields.filter((f) => !mapper.map((m) => m.fieldname).includes(f.name))
        .map((f) => {
          for (const fm of FIELD_MAPPING) {
            winston.debug(`testing ${fm.fallbackRegex} against ${f.label}`)
            if (fm.fallbackRegex.test(f.label)) {
              mapper.push({
                fieldname: f.name,
                sfdcMemberType: fm.sfdcMemberType,
              })
              break
            }
          }
        })
    }

    winston.debug(`${mapper.length} fields matched: ${JSON.stringify(mapper)}`)
    if (mapper.length === 0) {
      const fieldMapping = FIELD_MAPPING.map((fm: any) => { fm.fallbackRegex = fm.fallbackRegex.toString(); return fm })
      const e = `Query requires at least 1 field with a tag or regex match: ${JSON.stringify(fieldMapping)}`
      return new Hub.ActionResponse({ success: false, message: e })
    }

    const memberIds: MemberIds[] = []
    mapper.forEach((m) => {
      memberIds.push({
        ...m,
        data: dataJSON.data.map((row: any) => row[m.fieldname].value),
      })
    })

    let response: any = {}
    let tokens: Tokens

    try {
      const stateJson = JSON.parse(request.params.state_json)
      if (stateJson.access_token && stateJson.refresh_token) {
        tokens = stateJson
      } else {
        tokens = await this.sfdcOauthHelper.getAccessTokensFromAuthCode(stateJson)
      }

      // passing back connection object to handle access token refresh and update state
      const { message, sfdcConn } = await this.sfdcCampaignsSendData.sendData(request, memberIds, tokens)

      // return a fail status to surface salesforce API errors in the response message
      // message will only be visible in Looker if we send a fail status
      if (request.formParams.surface_sfdc_errors === "yes") {
        response.success = message.length === 0
      }

      response.message = message
      tokens = { access_token: sfdcConn.accessToken, refresh_token: sfdcConn.refreshToken }
      response.state = new Hub.ActionState()
      response.state.data = JSON.stringify(tokens)
    } catch (e: any) {
      response = { success: false, message: e.message }
    }
    return new Hub.ActionResponse(response)
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    let tokens: Tokens

    // uncomment the below to force a state reset and redo oauth login
    // if (request.params.state_json) {
    //   form.state = new Hub.ActionState();
    //   form.state.data = "reset";
    //   return form;
    // }

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
          tokens = await this.sfdcOauthHelper.getAccessTokensFromAuthCode(stateJson)
          form.state = new Hub.ActionState()
          form.state.data = JSON.stringify(tokens)
        }

        // passing back connection object to handle access token refresh and update state
        const { fields, sfdcConn } = await this.sfdcCampaignsFormBuilder.formBuilder(request, tokens)

        form.fields = fields
        tokens = { access_token: sfdcConn.accessToken, refresh_token: sfdcConn.refreshToken }
        form.state = new Hub.ActionState()
        form.state.data = JSON.stringify(tokens)

        return form
      } catch (e: any) {
        winston.debug(e.toString())
      }
    }

    // login form will be displayed if any errrors occur while fetching and building form
    const loginForm = await this.sfdcOauthHelper.makeLoginForm(request)
    return loginForm
  }
}

// Client ID is Salesforce Consumer Key
// Client Secret is Salesforce Consumer Secret
// Max results is max number of objects to fetch. Used in the form builder to get existing campaigns (default is 10,000)
// Chunk size is the number of sObject sent per single request (limit is 200 records)
if (process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET
  && process.env.SALESFORCE_MAX_RESULTS && process.env.SALESFORCE_CHUNK_SIZE) {

  const envMaxResults = parseInt(process.env.SALESFORCE_MAX_RESULTS + "", 10)
  const maxResults = Number.isInteger(envMaxResults) ? envMaxResults : 10000

  const envChunkSize = parseInt(process.env.SALESFORCE_CHUNK_SIZE + "", 10)
  const chunkSize = Number.isInteger(envChunkSize) ? envChunkSize : 200

  const sfdcCampaigns = new SalesforceCampaignsAction(
    process.env.SALESFORCE_CLIENT_ID,
    process.env.SALESFORCE_CLIENT_SECRET,
    maxResults,
    chunkSize,
  )
  Hub.addAction(sfdcCampaigns)
} else {
  winston.warn(
    `[Salesforce Campaigns] Action not registered because required environment variables are missing.`,
  )
}
