import * as uuid from "uuid"

import { LookmlModelExploreField as Field } from "../../api_types/lookml_model_explore_field"
import { LookmlModelExploreFieldset as Fieldset } from "../../api_types/lookml_model_explore_fieldset"
import * as Hub from "../../hub"
import { Row as JsonDetailRow } from "../../hub/json_detail"

const segment: any = require("analytics-node")

interface SegmentFields {
  idFieldNames: string[],
  idField: Field,
  userIdField: Field,
  groupIdField: Field,
  emailField: Field,
  anonymousIdField: Field,
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
    try {
      await this.processSegment(request, SegmentCalls.Identify)
      return new Hub.ActionResponse({ success: true })
    } catch (err) {
      return new Hub.ActionResponse({ success: false, message: err.message })
    }
  }

  protected async processSegment(request: Hub.ActionRequest, segmentCall: SegmentCalls) {
    const segmentClient = this.segmentClientFromRequest(request)

    let segmentFields: SegmentFields
    let fieldset: Fieldset

    // TODO pull run_at out of json_detail
    const timestamp = Date.now()
    const context = {
      app: {
        name: "looker/actions",
        version: process.env.APP_VERSION,
      },
    }

    /* tslint:disable no-console */
    await request.streamJsonDetail({
      onFields: (fields) => {
        console.log(`onFields ${fields}`)
        fieldset = fields
        segmentFields = this.segmentFields(fieldset)
        if (!segmentFields.idFieldNames || segmentFields.idFieldNames.length === 0) {
          throw new Error(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`)
        }
      },
      onRow: (row) => {
        console.log(`onFields ${row}`)
        if (!fieldset || !segmentFields) {
          throw new Error(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`)
        }
        const {
          traits,
          userId,
          anonymousId,
          groupId,
        } = this.prepareSegmentTraitsFromRow(row, fieldset, segmentFields)

        const payload = {
          anonymousId,
          context,
          traits,
          timestamp,
          userId,
          groupId,
        }
        if (!groupId) {
          delete payload.groupId
        }
        segmentClient[segmentCall](payload)
      },
    })
    await segmentClient.flush((err: any) => {
      return new Promise((resolve, reject) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  protected taggedFields(fieldset: Fieldset, tags: string[]) {
    let fields = fieldset.dimensions ? fieldset.dimensions : []
    fields = fields.concat(fieldset.measures ? fieldset.measures : [])
    return fields.filter((f: Field) =>
      f.tags && f.tags.some((t: string) => tags.indexOf(t) !== -1),
    )
  }

  protected taggedField(fieldset: Fieldset, tags: string[]) {
    return this.taggedFields(fieldset, tags)[0]
  }

  protected segmentFields(fieldset: Fieldset): SegmentFields {
    const idFieldNames = this.taggedFields(fieldset, [
      SegmentTags.Email,
      SegmentTags.SegmentAnonymousId,
      SegmentTags.UserId,
      SegmentTags.SegmentGroupId,
    ]).map((f: Field) => (f.name))

    return {
      idFieldNames,
      idField: this.taggedField(fieldset, [SegmentTags.UserId, SegmentTags.SegmentAnonymousId]),
      userIdField: this.taggedField(fieldset, [SegmentTags.UserId]),
      groupIdField: this.taggedField(fieldset, [SegmentTags.SegmentGroupId]),
      emailField: this.taggedField(fieldset, [SegmentTags.Email]),
      anonymousIdField: this.taggedField(fieldset, [SegmentTags.SegmentAnonymousId]),
    }
  }

  protected prepareSegmentTraitsFromRow(
    row: JsonDetailRow,
    fieldset: Fieldset,
    segmentFields: SegmentFields,
  ) {
    const traits: {[key: string]: string} = {}
    let fields = fieldset.dimensions ? fieldset.dimensions : []
    fields = fields.concat(fieldset.measures ? fieldset.measures : [])
    for (const field of fields) {
      const value = row[field.name].value
      if (segmentFields.idFieldNames.indexOf(field.name) === -1) {
        if (!field.hidden) {
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
