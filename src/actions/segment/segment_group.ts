import * as uuid from "uuid"

import * as Hub from "../../hub"

const segment: any = require("analytics-node")

export class SegmentGroupAction extends Hub.Action {

  tag = "segment_group_id"

  name = "segment_group"
  label = "Segment Group"
  iconName = "segment/segment.png"
  description = "Add traits and / or users to your Segment groups."
  params = [
    {
      description: "A write key for Segment.",
      label: "Segment Write Key",
      name: "segment_write_key",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = [{ tag: this.tag }]

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

      const groupIdField = fields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === this.tag),
      )[0]

      if (!groupIdField) {
        reject(`Query requires a field tagged ${this.tag}.`)
        return
      }
      const segmentClient = this.segmentClientFromRequest(request)

      const anonymousIdField = fields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === "segment_anonymous_id"),
      )[0]
      const anonymousId = this.generateAnonymousId()
      const userIdField = fields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === "user_id"),
      )[0]
      const emailField = fields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === "email"),
      )[0]

      const idFieldNames = [groupIdField.name]
      if (anonymousIdField) { idFieldNames.push(anonymousIdField.name) }
      if (userIdField) { idFieldNames.push(userIdField.name) }
      if (emailField) { idFieldNames.push(emailField.name) }

      const ranAt = qr.ran_at && new Date(qr.ran_at)

      const context = {
        app: {
          name: "looker/actions",
          version: process.env.APP_VERSION,
        },
      }

      for (const row of qr.data) {
        const traits: any = {}
        for (const field of fields) {
          const value = row[field.name].value
          if (idFieldNames.indexOf(field.name) === -1) {
            if (!hiddenFields.includes(field.name)) {
              traits[field.name] = value
            }
          }
          if (emailField && field.name === emailField.name) {
            traits.email = value
          }
        }

        const userId = userIdField ? row[userIdField.name].value : null

        segmentClient.group({
          groupId: groupIdField ? row[groupIdField.name].value : null,
          anonymousId: anonymousIdField ? row[anonymousIdField.name].value : userId ? null : anonymousId,
          context,
          traits,
          timestamp: ranAt,
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

  private segmentClientFromRequest(request: Hub.ActionRequest) {
    return new segment(request.params.segment_write_key)
  }

  private generateAnonymousId() {
    return uuid.v4()
  }

}

Hub.addAction(new SegmentGroupAction())
