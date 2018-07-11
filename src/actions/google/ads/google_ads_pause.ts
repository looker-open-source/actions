import * as Hub from "../../../hub"

import {GoogleAdsAction, GoogleAdsTags} from "./google_ads"

export class GoogleAdsPauseAction extends GoogleAdsAction {

  description = "Pause Google Ads keywords, ads, ad groups or campaigns."
  iconName = "google/ads/google_ads.svg"
  label = "Google Ads Pause"
  name = "google_ads_pause"

  async execute(request: Hub.ActionRequest) {
    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "Couldn't get data from attachment."
    }
    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }
    const fields = Hub.allFields(qr.fields)
    const googleAdFields = fields.filter((f) =>
      f.tags && f.tags.length > 0 && f.tags.some((t: string) => this.allowedTags.indexOf(t) !== -1),
    )
    if (googleAdFields.length === 0) {
      throw `Query requires a field tagged with google_ads.`
    }

    // TODO update call
    const client = this.googleAdsClientFromRequest(request)
    client.pause()
    return new Hub.ActionResponse()
  }

}

Hub.addAction(new GoogleAdsPauseAction())
