import * as uuid from "uuid"

import * as D from "../framework"

const segment: any = require("analytics-node")

export class SegmentIntegration extends D.Integration {

  allowedTags = ["email", "segment_user_id"]

  constructor() {
    super()

    this.name = "segment_event"
    this.label = "Segment"
    this.iconName = "segment.png"
    this.description = "Add traits to your users."
    this.params = [
      {
        description: "A write key for Segment.",
        label: "Segment Write Key",
        name: "segment_write_key",
        required: true,
        sensitive: true,
      },
    ]
    this.supportedActionTypes = ["query"]
    this.supportedFormats = ["json_detail"]
    this.supportedFormattings = ["unformatted"]
    this.supportedVisualizationFormattings = ["noapply"]
    this.requiredFields = [{any_tag: this.allowedTags}]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

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

      const identifiableFields = fields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => this.allowedTags.indexOf(t) !== -1),
      )
      if (identifiableFields.length === 0) {
        reject(`Query requires a field tagged ${this.allowedTags.join(" or ")}.`)
        return
      }

      const idField = identifiableFields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === "segment_user_id"),
      )[0]

      const emailField = identifiableFields.filter((f: any) =>
        f.tags && f.tags.some((t: string) => t === "email"),
      )[0]

      const segmentClient = this.segmentClientFromRequest(request)
      const anonymousId = this.generateAnonymousId()
      const ranAt = qr.ran_at && new Date(qr.ran_at)

      const context = {
        app: {
          name: "looker/integrations",
          version: process.env.APP_VERSION,
        },
      }

      for (const row of qr.data) {
        const traits: any = {
          // lookerQueryId: request.scheduledPlan && request.scheduledPlan.queryId,
          // lookerTitle: request.scheduledPlan && request.scheduledPlan.title,
        }
        for (const field of fields) {
          const value = row[field.name].value
          if (!idField || field.name !== idField.name) {
            traits[field.name] = value
          }
          if (emailField && field.name === emailField.name) {
            traits.email = value
          }
        }
        segmentClient.identify({
          anonymousId: idField ? null : anonymousId,
          context,
          traits,
          timestamp: ranAt,
          userId: idField ? row[idField.name].value : null,
        })
      }

      // TODO: does this batching have global state that could be a security problem
      segmentClient.flush((err: any) => {
        if (err) {
          reject(err)
        } else {
          resolve(new D.DataActionResponse())
        }
      })

    })
  }

  private segmentClientFromRequest(request: D.DataActionRequest) {
    return new segment(request.params.segment_write_key)
  }

  private generateAnonymousId() {
    return uuid.v4()
  }

}

D.addIntegration(new SegmentIntegration())
