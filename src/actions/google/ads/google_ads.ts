import * as Hub from "../../../hub"

// TODO update client
const adwords = require("adwords")

export enum GoogleAdsTags {
  CreativeId = "google_ads:creative_id",
  CriteriaId = "google_ads:criteria_id",
  AdGroupId = "google_ads:ad_group_id",
  CampaignId = "google_ads:campaign_id",
  AccountId = "google_ads:account_id",
}

export abstract class GoogleAdsAction extends Hub.Action {
  allowedTags: string[] = [
    GoogleAdsTags.CreativeId,
    GoogleAdsTags.CriteriaId,
    GoogleAdsTags.AdGroupId,
    GoogleAdsTags.CampaignId,
    GoogleAdsTags.AccountId,
  ]

  // TODO update params
  params = [
    {
      name: "secret",
      label: "AdWords Secret",
      required: true,
      sensitive: false,
      description: "",
    },
  ]

  requiredFields = [{ any_tag: this.allowedTags }]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]

  protected googleAdsClientFromRequest(request: Hub.ActionRequest) {
    // TODO uupdate client
    const config = {
      secret: request.params.secret,
    }
    return new adwords(config)
  }

}
