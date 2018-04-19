import * as Hub from "../../hub"
import { SegmentAction } from "./segment"

export class SegmentTrackAction extends SegmentAction {

  name = "segment_track"
  label = "Segment Track"
  iconName = "segment/segment.png"
  description = "Add traits via track to your Segment users."
  minimumSupportedLookerVersion = "5.5.0"

  async execute(request: Hub.ActionRequest) {
    return new Promise<Hub.ActionResponse>((resolve, reject) => {

      if (!(request.attachment && request.attachment.dataJSON)) {
        reject("No attached json")
        return
      }

      const qr = request.attachment.dataJSON
      if (!qr.fields || !qr.data) {
        reject("Request payload is an invalid format.")
        return
      }

      const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
      let hiddenFields = []
      if (request.scheduledPlan &&
          request.scheduledPlan.query &&
          request.scheduledPlan.query.vis_config &&
          request.scheduledPlan.query.vis_config.hidden_fields) {
        hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields
      }

      const segmentFields = this.segmentFields(fields)
      if (!segmentFields.idFieldNames || segmentFields.idFieldNames.length === 0) {
        reject(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`)
        return
      }
      const timestamp = qr.ran_at && new Date(qr.ran_at)
      const context = {
        app: {
          name: "looker/actions",
          version: process.env.APP_VERSION,
        },
      }
      const segmentClient = this.segmentClientFromRequest(request)

      for (const row of qr.data) {
        const {
          traits,
          userId,
          anonymousId,
        } = this.prepareSegmentTraitsFromRow(row, fields, segmentFields, hiddenFields)

        segmentClient.track({
          anonymousId,
          context,
          event: request.formParams.event!,
          properties: traits,
          timestamp,
          userId,
        })
      }

      segmentClient.flush((err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(new Hub.ActionResponse())
        }
      })

    })
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      name: "event",
      label: "Event",
      description: "The name of the event you’re tracking.",
      type: "string",
      required: true,
    }]
    return form
  }

}

Hub.addAction(new SegmentTrackAction())
