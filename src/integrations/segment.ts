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
      if (!qr.fields) {
        reject("Request payload is an invalid format.")
        return
      }

      const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))

      const idFields = fields.filter((f: any) =>
        f.tags.some((t: string) => this.allowedTags.indexOf(t) !== -1),
      )

      if (idFields.length === 0) {
        reject(`Query requires a field tagged ${this.allowedTags.join(" or ")}`)
        return
      }

      const segmentClient = this.segmentClientFromRequest(request)
      const anonymousId = uuid.v4()

      const idField: any = idFields[0]

      for (const row of qr.data) {
        const idValue = row[idField.name].value
        const traits: any = {}
        for (const field of fields) {
          if (field.name !== idField.name) {
            traits[field.name] = row[field.name].value
          }
        }
        segmentClient.identify({
          anonymousId,
          traits,
          userId: idValue,
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

}

D.addIntegration(new SegmentIntegration())
