import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import { CustomerIoTrackAction } from "./customerio_track"

const action = new CustomerIoTrackAction()
action.executeInOwnProcess = false

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it ("calls track", () => {
      const customerIoCallSpy = sinon.spy(async () => Promise.resolve())
      const stubClient = sinon.stub(action as any, "customerIoClientFromRequest")
        .callsFake(() => {
          return {track: customerIoCallSpy, flush: (cb: () => void) => cb()}
        })

      const now = new Date()
      const clock = sinon.useFakeTimers(now.getTime())

      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
          fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
          data: [{coolfield: {value: "funvalue"}}],
        }))}

      return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
        stubClient.restore()
        clock.restore()
      })
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })

})
