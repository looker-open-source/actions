import * as chai from "chai"

import * as Hub from "../src/hub"
import { ActionRequest } from "../src/hub"

describe("Hub.ActionRequest", () => {
  describe("Hub.ActionRequest.streamJsonDetail", () => {
    it("Can stream with nested data objects",  async () => {
      const req = new ActionRequest()
      // Very incomplete json_detail response
      const detail = {
        pivots: [{key: "k", data: {value: "hi"}}],
        fields: {dimensions: [{name: "id"}]},
        data: [{id: {value: "bob"}}],
      }
      const buf = Buffer.from(JSON.stringify(detail))
      req.attachment = {
        dataBuffer: buf,
      }
      let fieldset: Hub.Field[] = []
      return new Promise<void>(async (res, rej) => {
        await req.streamJsonDetail({
          onFields: (fields) => {
            fieldset = Hub.allFields(fields)
            chai.expect(fieldset.length).to.equal(1)
          },
          onRow: (row) => {
            chai.expect(fieldset.length).to.equal(1)
            chai.expect(row).to.deep.equal({id: {value: "bob"}})
            res()
          },
        }).catch((err) => {
          rej(err)
        })
      })
    }).timeout(10000)
  })
})
