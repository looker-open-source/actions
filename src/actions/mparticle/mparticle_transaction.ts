import * as winston from "winston"
import * as Hub from "../../hub"

import * as httpRequest from "request-promise-native"

import { ENVIRONMENT, EVENT, EVENT_NAME, EVENT_TYPE, MP_API_URL, USER } from "./mparticle_constants"
import { MparticleEventMaps, MparticleEventTags, MparticleUserMaps, MparticleUserTags } from "./mparticle_enums"
import { mparticleErrorCodes } from "./mparticle_error_codes"

const maxEventsPerBatch = process.env.MAX_EVENTS_PER_BATCH

import { LookmlModelExploreField as ExploreField } from "../../api_types/lookml_model_explore_field"

interface Mapping {
  customAttributes?: object
  dataEventAttributes?: object
  deviceInfo?: object
  eventName?: object
  userAttributes?: object
  userIdentities?: object
}

interface MparticleBulkEvent { [key: string]: any }

export class MparticleTransaction {
  apiKey: string | undefined
  apiSecret: string | undefined
  eventType = ""
  errors: any = []

  // The mapping for user-related data
  userIdentities: {[key: string]: string} = {
    [MparticleUserTags.MpCustomerId]: MparticleUserMaps.Customerid,
    [MparticleUserTags.MpEmail]: MparticleUserMaps.Email,
    [MparticleUserTags.MpFacebook]: MparticleUserMaps.Facebook,
    [MparticleUserTags.MpGoogle]: MparticleUserMaps.Google,
    [MparticleUserTags.MpMicrosoft]: MparticleUserMaps.Microsoft,
    [MparticleUserTags.MpTwitter]: MparticleUserMaps.Twitter,
    [MparticleUserTags.MpYahoo]: MparticleUserMaps.Yahoo,
    [MparticleUserTags.MpOther]: MparticleUserMaps.Other,
    [MparticleUserTags.MpOther2]: MparticleUserMaps.Other2,
    [MparticleUserTags.MpOther3]: MparticleUserMaps.Other3,
    [MparticleUserTags.MpOther4]: MparticleUserMaps.Other4,
  }

  // The mapping for event-related data, specific to API request's data section.
  dataEventAttributes: {[key: string]: string} = {
    [MparticleEventTags.MpCustomEventType]: MparticleEventMaps.CustomEventType,
    [MparticleEventTags.MpEventId]: MparticleEventMaps.EventId,
    [MparticleEventTags.MpTimestampUnixtimeMs]: MparticleEventMaps.TimestampUnixtimeMs,
    [MparticleEventTags.MpSessionId]: MparticleEventMaps.SessionId,
    [MparticleEventTags.MpSessionUuid]: MparticleEventMaps.SessionUuid,
  }

  async handleRequest(request: Hub.ActionRequest): Promise<Hub.ActionResponse> {
    let rows: Hub.JsonDetail.Row[] = []
    let mapping: Mapping = {}
    this.eventType = this.setEventType(request.formParams.data_type)

    const { apiKey, apiSecret } = request.params
    this.apiKey = apiKey
    this.apiSecret = apiSecret

    try {
      await request.streamJsonDetail({
        onFields: (fields) => {
          mapping = this.createMappingFromFields(fields)
        },
        onRow: (row) => {
          rows.push(row)
          if (rows.length === Number(maxEventsPerBatch)) {
            this.sendChunk(rows, mapping).catch((e) => {
              throw e
            })
            rows = []
          }
        },
      })
    } catch (e) {
      if (e === "Each row must specify at least 1 identity tag.") { throw e }
      this.errors.push(e)
    }

    try {
      // if any rows are left, send one more chunk
      if (rows.length > 0) {
        await this.sendChunk(rows, mapping)
      }
      if (this.errors.length === 0) {
        return new Hub.ActionResponse({ success: true })
      } else {
        return new Hub.ActionResponse({ success: false, message: this.errors[0] })
      }
    } catch (e) {
      return new Hub.ActionResponse({ success: false, message: e.message })
    }
  }

  async sendChunk(rows: Hub.JsonDetail.Row[], mapping: any) {
    const chunk = rows.slice(0)
    const body: MparticleBulkEvent[] = []
    chunk.forEach((row: Hub.JsonDetail.Row) => {
      const eventEntry = this.createEvent(row, mapping)
      body.push(eventEntry)
    })

    winston.debug("BODY", JSON.stringify(body))
    // winston.debug("SENDING CHUNK", body.length)
    const options = this.postOptions(body)
    await httpRequest.post(options).promise().catch((e: any) => {
      this.errors.push(`${e.statusCode} - ${mparticleErrorCodes[e.statusCode]}`)
    })
  }

  protected createEvent(row: Hub.JsonDetail.Row, mapping: any) {
    const eventUserIdentities: any = {}
    const eventUserAttributes: any = {}
    const data: any = {
      event_name: EVENT_NAME,
    }

    Object.keys(mapping.userIdentities).forEach((attr: any) => {
      const key = mapping.userIdentities[attr]
      const val = row[attr].value
      eventUserIdentities[key] = val
    })

    Object.keys(mapping.userAttributes).forEach((attr: any) => {
      const key = mapping.userAttributes[attr]
      const val = row[attr].value
      eventUserAttributes[key] = val
    })

    if (this.eventType === EVENT) {
      data.device_info = {}
      data.custom_attributes = {}
      if (mapping.eventName) {
        Object.keys(mapping.eventName).forEach((attr: any) => {
          data.event_name = row[attr].value
        })
      }
      if (mapping.deviceInfo) {
        Object.keys(mapping.deviceInfo).forEach((attr: any) => {
          const key = mapping.deviceInfo[attr]
          const val = row[attr].value
          data.device_info[key] = val
        })
      }
      if (mapping.dataEventAttributes) {
        Object.keys(mapping.dataEventAttributes).forEach((attr: any) => {
          const key = mapping.dataEventAttributes[attr]
          const val = row[attr].value
          data[key] = val
        })
      }
      if (mapping.customAttributes) {
        Object.keys(mapping.customAttributes).forEach((attr: any) => {
          const key = mapping.customAttributes[attr]
          const val = row[attr].value
          data.custom_attributes[key] = val
        })
      }
    }

    return {
      events: [
        {
          data,
          event_type: EVENT_TYPE,
        },
      ],
      user_attributes: eventUserAttributes,
      user_identities: eventUserIdentities,
      schema_version: 2,
      environment: ENVIRONMENT,
    }
  }

  protected containsUserIdentity(userIdentities: any): boolean {
    return (Object.getOwnPropertyNames(userIdentities).length > 0)
  }

  protected setEventType(dataType: string | undefined) {
    if (dataType === USER) {
      return USER
    } else if (dataType === EVENT) {
      return EVENT
    }
    throw "Missing data type (user|event)."
  }

  // Sets up the map object and loops over all fields.
  protected createMappingFromFields(fields: any) {
    let mapping: Mapping
    if (this.eventType === USER) {
      mapping = {
        userIdentities: {},
        userAttributes: {},
      }
    } else {
      mapping = {
        userIdentities: {},
        userAttributes: {},
        eventName: {},
        deviceInfo: {},
        dataEventAttributes: {},
        customAttributes: {},
      }
    }

    fields.measures.forEach((field: ExploreField) => {
      this.mapObject(mapping, field)
    })
    fields.dimensions.forEach((field: ExploreField) => {
      this.mapObject(mapping, field)
    })
    fields.table_calculations.forEach((field: ExploreField) => {
      this.mapObject(mapping, field)
    })

    if (!this.containsUserIdentity(mapping.userIdentities)) {
      const err = "Each row must specify at least 1 identity tag."
      this.errors.push(err)
      throw err
    }

    return mapping
  }

  protected mapObject(mapping: any, field: ExploreField) {
    const tag = field.tags && field.tags[0] ? field.tags[0] : ''
    if (this.eventType === USER) {
      if (Object.keys(this.userIdentities).indexOf(tag) !== -1) {
        mapping.userIdentities[field.name] = this.userIdentities[tag]
      } else {
        mapping.userAttributes[field.name] = `looker_${field.name}`
      }
    } else {
      if (Object.keys(this.userIdentities).indexOf(tag) !== -1) {
        mapping.userIdentities[field.name] = this.userIdentities[tag]
      // TODO: Move into enum
      } else if (tag === "mp_user_attribute") {
        mapping.userAttributes[field.name] = `looker_${field.name}`
      } else if (tag === MparticleEventTags.MpEventName) {
        mapping.eventName[field.name] = MparticleEventMaps.EventName
      } else if (tag === MparticleEventTags.MpDeviceInfo) {
        mapping.deviceInfo[field.name] = `looker_${field.name}`
      } else if (Object.keys(this.dataEventAttributes).indexOf(tag) !== -1) {
        mapping.dataEventAttributes[field.name] = this.dataEventAttributes[tag]
      } else {
        mapping.customAttributes[field.name] = `looker_${field.name}`
      }
    }
  }

  protected postOptions(body: MparticleBulkEvent[]) {
    const auth = Buffer
      .from(`${this.apiKey}:${this.apiSecret}`)
      .toString("base64")

    return {
      url: MP_API_URL,
      headers: {
        Authorization: `Basic ${auth}`,
      },
      body,
      json: true,
      resolveWithFullResponse: true,
    }
  }
}
