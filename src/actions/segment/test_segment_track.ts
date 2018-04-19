import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import { SegmentTrackAction } from "./segment_track"

const action = new SegmentTrackAction()

function expectSegmentMatch(request: Hub.ActionRequest, match: any) {
  const segmentCallSpy = sinon.spy()
  const stubClient = sinon.stub(action as any, "segmentClientFromRequest")
    .callsFake(() => {
      return {track: segmentCallSpy, flush: (cb: () => void) => cb()}
     })
  const stubAnon = sinon.stub(action as any, "generateAnonymousId").callsFake(() => "stubanon")
  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(segmentCallSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
    stubAnon.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json")
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json")
    })

    it("errors if the query response has no fields", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {wrong: true}}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if the query response is has no data", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {fields: []}}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if there is no tagged field", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {fields: [{}], data: []}}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged email or user_id or segment_anonymous_id.")
    })

    it("errors if there is no write key", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [],
      }}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("You must pass your Segment project's write key.")
    })

    it("works with user_id", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "funvalue",
        anonymousId: null,
        event: "funevent",
      })
    })

    it("works with email", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["email"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return expectSegmentMatch(request, {
        anonymousId: "stubanon",
        userId: null,
        properties: {email: "funvalue"},
        event: "funevent",
       })
    })

    it("works with email and user id", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolemail", tags: ["email"]}, {name: "coolid", tags: ["user_id"]}],
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "id",
        properties: {email: "email@email.email"},
        anonymousId: null,
        event: "funevent",
      })
    })

    it("works with email, user id and anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "coolanonymousid", tags: ["segment_anonymous_id"]}],
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}, coolanonymousid: {value: "anon_id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "id",
        properties: {email: "email@email.email"},
        anonymousId: "anon_id",
        event: "funevent",
      })
    })

    it("works with user id and anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolid", tags: ["user_id"]}, {name: "coolanonymousid", tags: ["segment_anonymous_id"]}],
        data: [
            {coolid: {value: "id"}, coolanonymousid: {value: "anon_id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "id",
        anonymousId: "anon_id",
        event: "funevent",
      })
    })

    it("works with anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [
            {name: "coolanonymousid", tags: ["segment_anonymous_id"]}],
        data: [{coolanonymousid: {value: "anon_id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "anon_id",
        anonymousId: "anon_id",
        event: "funevent",
      })
    })

    it("doesn't send hidden fields", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["email"]}],
        data: [{coolfield: {value: "funvalue"}, hiddenfield: {value: "hiddenvalue"}}],
      }}
      request.scheduledPlan = {
        query: {
          vis_config: {
            hidden_fields: [
              "hiddenfield",
            ],
          },
        },
      } as any
      return expectSegmentMatch(request, {
        anonymousId: "stubanon",
        userId: null,
        properties: {email: "funvalue"},
        event: "funevent",
       })
    })

    it("works with null user_id", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        event: "funevent",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: null}}],
      }}
      return expectSegmentMatch(request, {
        userId: null,
        anonymousId: "stubanon",
        event: "funevent",
      })
    })

  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })

})
