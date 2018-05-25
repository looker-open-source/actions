import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import { SegmentTrackAction } from "./segment_track"

const action = new SegmentTrackAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it ("calls track", () => {
      const segmentCallSpy = sinon.spy()
      const stubClient = sinon.stub(action as any, "segmentClientFromRequest")
        .callsFake(() => {
          return {track: segmentCallSpy, flush: (cb: () => void) => cb()}
        })
      const stubAnon = sinon.stub(action as any, "generateAnonymousId").callsFake(() => "stubanon")
      const stubNow = sinon.stub(Date as any, "now").callsFake(() => "now")

      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
          fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
          data: [{coolfield: {value: "funvalue"}}],
        }))}

      return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
        chai.expect(segmentCallSpy).to.have.been.calledWithExactly({
          userId: "funvalue",
          anonymousId: null,
          event: "funevent",
          traits: {},
          context: {
            app: {
              name: "looker/actions",
              version: "dev",
            },
          },
          timestamp: "now",
        })
        stubClient.restore()
        stubAnon.restore()
        stubNow.restore()
      })
    })
  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })

})
