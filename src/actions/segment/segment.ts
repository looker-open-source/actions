import * as uuid from "uuid"

import * as Hub from "../../hub"
import { SegmentActionError } from "./segment_error"

const segment: any = require("analytics-node")

interface SegmentFields {
  idFieldNames: string[],
  idField: Hub.Field,
  userIdField: Hub.Field,
  groupIdField: Hub.Field,
  emailField: Hub.Field,
  anonymousIdField: Hub.Field,
}

export enum SegmentTags {
  UserId = "user_id",
  SegmentAnonymousId = "segment_anonymous_id",
  Email = "email",
  SegmentGroupId = "segment_group_id",
}

export enum SegmentCalls {
  Identify = "identify",
  Track = "track",
  Group = "group",
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
  usesStreaming = true
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = [{ any_tag: this.allowedTags }]

  async execute(request: Hub.ActionRequest) {
    return this.executeSegment(request, SegmentCalls.Identify)
  }

  protected async executeSegment(request: Hub.ActionRequest, segmentCall: SegmentCalls) {
    const segmentClient = this.segmentClientFromRequest(request)

    let hiddenFields: string[] = []
    if (request.scheduledPlan &&
        request.scheduledPlan.query &&
        request.scheduledPlan.query.vis_config &&
        request.scheduledPlan.query.vis_config.hidden_fields) {
      hiddenFields = request.scheduledPlan.query.vis_config.hidden_fields
    }

    let segmentFields: SegmentFields | undefined
    let fieldset: Hub.Field[] = []
    const errors: Error[] = []

    let timestamp = Date.now()
    const context = {
      app: {
        name: "looker/actions",
        version: process.env.APP_VERSION || "dev",
      },
    }
    const event = request.formParams.event

    await request.streamJsonDetail({
      onFields: (fields) => {
        fieldset = Hub.allFields(fields)
        segmentFields = this.segmentFields(fieldset)
        this.unassignedSegmentFieldsCheck(segmentFields)
      },
      onRanAt: (iso8601string) => {
        if (iso8601string) {
          timestamp = new Date(iso8601string).getTime()
        }
      },
      onRow: (row) => {
        this.unassignedSegmentFieldsCheck(segmentFields)
        const payload = {
          ...this.prepareSegmentTraitsFromRow(row, fieldset, segmentFields!, hiddenFields),
          ...{event, context, timestamp},
        }
        if (payload.groupId === null) {
          delete payload.groupId
        }
        if (!payload.event) {
          delete payload.event
        }
        try {
          segmentClient[segmentCall](payload)
        } catch (e) {
          errors.push(e)
        }
      },
    })

    try {
      await segmentClient.flush(async (err: any) => {
        return new Promise<any>((resolve, reject) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    } catch (e) {
      errors.push(e)
    }

    if (errors) {
      return new Hub.ActionResponse({
        success: false,
        message: errors.map((e) => e.message).join(", "),
      })
    } else {
      return new Hub.ActionResponse({ success: true })
    }
  }

  protected unassignedSegmentFieldsCheck(segmentFields: SegmentFields | undefined) {
    if (!(segmentFields && segmentFields.idFieldNames && segmentFields.idFieldNames.length > 0)) {
      throw new SegmentActionError(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`)
    }
  }

  protected taggedFields(fields: Hub.Field[], tags: string[]) {
    return fields.filter((f: Hub.Field) =>
      f.tags && f.tags.some((t: string) => tags.indexOf(t) !== -1),
    )
  }

  protected taggedField(fields: any[], tags: string[]) {
    return this.taggedFields(fields, tags)[0]
  }

  protected segmentFields(fields: Hub.Field[]): SegmentFields {
    const idFieldNames = this.taggedFields(fields, [
      SegmentTags.Email,
      SegmentTags.SegmentAnonymousId,
      SegmentTags.UserId,
      SegmentTags.SegmentGroupId,
    ]).map((f: Hub.Field) => (f.name))

    return {
      idFieldNames,
      idField: this.taggedField(fields, [SegmentTags.UserId, SegmentTags.SegmentAnonymousId]),
      userIdField: this.taggedField(fields, [SegmentTags.UserId]),
      groupIdField: this.taggedField(fields, [SegmentTags.SegmentGroupId]),
      emailField: this.taggedField(fields, [SegmentTags.Email]),
      anonymousIdField: this.taggedField(fields, [SegmentTags.SegmentAnonymousId]),
    }
  }

  protected prepareSegmentTraitsFromRow(
    row: Hub.JsonDetail.Row,
    fields: Hub.Field[],
    segmentFields: SegmentFields,
    hiddenFields: string[],
  ) {
    const traits: {[key: string]: string} = {}
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
    const userId: string | null = segmentFields.idField ? row[segmentFields.idField.name].value : null
    let anonymousId: string | null
    if (segmentFields.anonymousIdField) {
      anonymousId = row[segmentFields.anonymousIdField.name].value
    } else {
      anonymousId = userId ? null : this.generateAnonymousId()
    }
    const groupId: string | null = segmentFields.groupIdField ? row[segmentFields.groupIdField.name].value : null

    return {
      traits,
      userId,
      anonymousId,
      groupId,
    }
  }

  protected segmentClientFromRequest(request: Hub.ActionRequest) {
    return new segment(request.params.segment_write_key)
  }

  protected generateAnonymousId() {
    return uuid.v4()
  }

}

Hub.addAction(new SegmentAction())
