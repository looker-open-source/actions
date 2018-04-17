import * as uuid from "uuid"

import * as Hub from "../../hub"

const segment: any = require("analytics-node")

interface SegmentFields {
  idFieldNames: string[],
  idField: any,
  userIdField: any,
  groupIdField: any,
  emailField: any,
  anonymousIdField: any,
}

export enum SegmentTags {
  UserId = "user_id",
  SegmentAnonymousId = "segment_anonymous_id",
  Email = "email",
  SegmentGroupId = "segment_group_id",
}

export class SegmentAction extends Hub.Action {

  allowedTags = [SegmentTags.Email, SegmentTags.UserId, SegmentTags.SegmentAnonymousId]

  name = "segment_event"
  label = "Segment Identify"
  iconName = "segment/segment.png"
  description = "Add traits via identify to your Segment users."
  params = [
    {
      description: "A write key for Segment.",
      label: "Segment Write Key",
      name: "segment_write_key",
      required: true,
      sensitive: true,
    },
  ]
  minimumSupportedLookerVersion = "4.20.0"
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = [{ any_tag: this.allowedTags }]

  taggedFields(fields: any, tags: string[]) {
    return fields.filter((f: any) =>
      f.tags && f.tags.some((t: string) => tags.indexOf(t) !== -1),
    )
  }

  taggedField(fields: any, tags: string[]) {
    return this.taggedFields(fields, tags)[0]
  }

  segmentFields(fields: any): SegmentFields {
    const idFieldNames = this.taggedFields(fields, [
      SegmentTags.Email,
      SegmentTags.SegmentAnonymousId,
      SegmentTags.UserId,
      SegmentTags.SegmentGroupId,
    ]).map((f: any) => (f.name))

    return {
      idFieldNames,
      idField: this.taggedField(fields, [SegmentTags.UserId, SegmentTags.SegmentAnonymousId]),
      userIdField: this.taggedField(fields, [SegmentTags.UserId]),
      groupIdField: this.taggedField(fields, [SegmentTags.SegmentGroupId]),
      emailField: this.taggedField(fields, [SegmentTags.Email]),
      anonymousIdField: this.taggedField(fields, [SegmentTags.SegmentAnonymousId]),
    }
  }

  prepareSegmentTraitsFromRow(row: any, fields: any[], segmentFields: SegmentFields, hiddenFields: any[]) {
    const traits: any = {}
    for (const field of fields) {
      const value = row[field.name].value
      if (segmentFields.idFieldNames.indexOf(field.name) === -1) {
        if (hiddenFields.indexOf(field.name) === -1) {
          traits[field.name] = value
        }
      }
      if (segmentFields.emailField && field.name === segmentFields.emailField.name) {
        traits.email = value
      }
    }
    const userId = segmentFields.idField ? row[segmentFields.idField.name].value : null
    let anonymousId
    if (segmentFields.anonymousIdField) {
      anonymousId = row[segmentFields.anonymousIdField.name].value
    } else {
      anonymousId = userId ? null : this.generateAnonymousId()
    }
    const groupId = segmentFields.groupIdField ? row[segmentFields.groupIdField.name].value : null

    return {
      traits,
      userId,
      anonymousId,
      groupId,
    }
  }

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

        segmentClient.identify({
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

  segmentClientFromRequest(request: Hub.ActionRequest) {
    return new segment(request.params.segment_write_key)
  }

  private generateAnonymousId() {
    return uuid.v4()
  }

}

Hub.addAction(new SegmentAction())
