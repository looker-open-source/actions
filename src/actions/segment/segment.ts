import * as util from "util"
import * as uuid from "uuid"
import * as winston from "winston"

import * as semver from "semver"
import * as Hub from "../../hub"
import {SegmentActionError} from "./segment_error"

const segment: any = require("analytics-node")

interface SegmentFields {
  idFieldNames: string[],
  idField?: Hub.Field,
  userIdField?: Hub.Field,
  groupIdField?: Hub.Field,
  emailField?: Hub.Field,
  anonymousIdField?: Hub.Field,
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
  supportedFormattings = [Hub.ActionFormatting.Unformatted]
  supportedVisualizationFormattings = [Hub.ActionVisualizationFormatting.Noapply]
  requiredFields = [{ any_tag: this.allowedTags }]
  executeInOwnProcess = true
  supportedFormats = (request: Hub.ActionRequest) => {
    if (request.lookerVersion && semver.gte(request.lookerVersion, "6.2.0")) {
      return [Hub.ActionFormat.JsonDetailLiteStream]
    } else {
      return [Hub.ActionFormat.JsonDetail]
    }
  }

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

    let timestamp = new Date()
    const context = {
      app: {
        name: "looker/actions",
        version: process.env.APP_VERSION ? process.env.APP_VERSION : "dev",
      },
    }
    const event = request.formParams.event

    try {

      await request.streamJsonDetail({
        onFields: (fields) => {
          fieldset = Hub.allFields(fields)
          segmentFields = this.segmentFields(fieldset)
          this.unassignedSegmentFieldsCheck(segmentFields)
        },
        onRanAt: (iso8601string) => {
          if (iso8601string) {
            timestamp = new Date(iso8601string)
          }
        },
        onRow: (row) => {
          this.unassignedSegmentFieldsCheck(segmentFields)
          const payload = {
            ...this.prepareSegmentTraitsFromRow(
              row, fieldset, segmentFields!, hiddenFields,
                segmentCall === SegmentCalls.Track, segmentCall === SegmentCalls.Group),
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

      await new Promise<void>(async (resolve, reject) => {
          segmentClient.flush( (err: any) => {
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

    if (errors.length > 0) {
      let msg = errors.map((e) => e.message ? e.message : e).join(", ")
      if (msg.length === 0) {
        msg = "An unknown error occurred while processing the Segment action."
        winston.warn(`Can't format Segment errors: ${util.inspect(errors)}`)
      }
      return new Hub.ActionResponse({success: false, message: msg})
    } else {
      return new Hub.ActionResponse({success: true})
    }
  }

  protected unassignedSegmentFieldsCheck(segmentFields: SegmentFields | undefined) {
    if (!(segmentFields && segmentFields.idFieldNames.length > 0)) {
      throw new SegmentActionError(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`)
    }
  }

  protected taggedFields(fields: Hub.Field[], tags: string[]) {
    return fields.filter((f) =>
      f.tags && f.tags.length > 0 && f.tags.some((t: string) => tags.indexOf(t) !== -1),
    )
  }

  protected taggedField(fields: any[], tags: string[]): Hub.Field | undefined {
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

  // Removes JsonDetail Cell metadata and only sends relevant nested data to Segment
  // See JsonDetail.ts to see structure of a JsonDetail Row
  protected filterJson(jsonRow: any, segmentFields: SegmentFields, fieldName: string) {
    const pivotValues: any = {}
    pivotValues[fieldName] = []
    const filterFunction = (currentObject: any, name: string) => {
      const returnVal: any = {}
      if (Object(currentObject) === currentObject) {
        for (const key in currentObject) {
          if (currentObject.hasOwnProperty(key)) {
            if (key === "value") {
              returnVal[name] = currentObject[key]
              return returnVal
            } else if (segmentFields.idFieldNames.indexOf(key) === -1) {
              const res = filterFunction(currentObject[key], key)
              if (res !== {}) {
                pivotValues[fieldName].push(res)
              }
            }
          }
        }
      }
      return returnVal
    }
    filterFunction(jsonRow, fieldName)
    return pivotValues
  }

  protected prepareSegmentTraitsFromRow(
    row: Hub.JsonDetail.Row,
    fields: Hub.Field[],
    segmentFields: SegmentFields,
    hiddenFields: string[],
    trackCall: boolean,
    groupCall: boolean,
  ) {
    const traits: { [key: string]: string } = {}
    for (const field of fields) {
      if (segmentFields.idFieldNames.indexOf(field.name) === -1) {
        if (hiddenFields.indexOf(field.name) === -1) {
          let values: any = {}
          if (!row.hasOwnProperty(field.name)) {
            winston.error("Field name does not exist for Segment action")
            throw new SegmentActionError(`Field id ${field.name} does not exist for JsonDetail.Row`)
          }
          if (row[field.name].value || row[field.name].value === 0) {
            values[field.name] = row[field.name].value
          } else {
            values = this.filterJson(row[field.name], segmentFields, field.name)
          }
          for (const key in values) {
            if (values.hasOwnProperty(key)) {
              traits[key] = values[key]
            }
          }
        }
      }
      if (segmentFields.emailField && field.name === segmentFields.emailField.name) {
        traits.email = row[field.name].value
      }
    }
    const userId: string | null = segmentFields.idField ? row[segmentFields.idField.name].value : null
    let anonymousId: string | null
    if (segmentFields.anonymousIdField) {
      anonymousId = row[segmentFields.anonymousIdField.name].value
    } else if (groupCall) {
      // If this is a Segment Group Call, do not send an anonymous ID to preserve
      // Segment API quotas
      anonymousId = null
    } else {
      anonymousId = userId ? null : this.generateAnonymousId()
    }
    const groupId: string | null = segmentFields.groupIdField ? row[segmentFields.groupIdField.name].value : null

    const dimensionName = trackCall ? "properties" : "traits"

    const segmentRow: any = {
      userId,
      anonymousId,
      groupId,
    }
    segmentRow[dimensionName] = traits
    return segmentRow
  }

  protected segmentClientFromRequest(request: Hub.ActionRequest) {
    return new segment(request.params.segment_write_key)
  }

  protected generateAnonymousId() {
    return uuid.v4()
  }

}

Hub.addAction(new SegmentAction())
