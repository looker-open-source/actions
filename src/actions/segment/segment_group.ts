import * as Hub from "../../hub"
import { SegmentAction, SegmentTags } from "./segment"

export class SegmentGroupAction extends SegmentAction {

  tag = SegmentTags.SegmentGroupId

  name = "segment_group"
  label = "Segment Group"
  iconName = "segment/segment.png"
  description = "Add traits and / or users to your Segment groups."
  requiredFields = [{ tag: this.tag , any_tag: this.allowedTags}]
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
      if (!segmentFields.groupIdField) {
        reject(`Query requires a field tagged ${this.tag}.`)
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
          groupId,
        } = this.prepareSegmentTraitsFromRow(row, fields, segmentFields, hiddenFields)

        segmentClient.group({
          groupId,
          anonymousId,
          context,
          traits,
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

}

Hub.addAction(new SegmentGroupAction())
