import Segment = require("analytics-node")
import * as D from "../framework"

class SegmentIntegration extends D.Integration {

  name: "segment_event"
  label: "Segment - Identify User"
  iconName: "segment.png"
  description: "Add traits to your users."
  params: [
    {
      description: "A write key for Segment.",
      label: "Segment Write Key",
      name: "segment_write_key",
      required: true,
      sensitive: true,
    }
  ]
  supportedActionTypes: ["query"]
  supportedFormats: ["json_detail"]
  supportedFormattings: ["unformatted"]
  supportedVisualizationFormattings: ["noapply"]
  requiredFields: [{any_tag: ["email", "segment_user_id"]}]

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {

      const segment = this.segmentClientFromRequest(request)

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

      const tags: string[] = this.requiredFields[0].any_tag

      const idFields = fields.filter((f: any) =>
        f.tags.some((t: string) => tags.indexOf(t) !== -1),
      )

      if (idFields.length === 0) {
        reject(`Query requires a field tagged ${tags.join(" or ")}`)
        return
      }

      const idField: any = idFields[0]

      for (const row of qr.data) {
        const idValue = row[idField.name].value
        const traits: any = {}
        for (const field of fields) {
          if (field.name !== idField.name) {
            traits[field.name] = row[field.name].value
          }
        }
        segment.identify({
          traits,
          userId: idValue,
        })
      }

      // TODO: does this batching have global state that could be a security problem
      segment.flush((err, _batch) => {
        if (err) {
          reject(err)
        } else {
          resolve(new D.DataActionResponse())
        }
      })

    })
  }

  private segmentClientFromRequest(request: D.DataActionRequest) {
    return new Segment(request.params.segment_write_key)
  }

}

D.addIntegration(new SegmentIntegration())
