import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import { SegmentAction } from "./segment"

const action = new SegmentAction()

function expectSegmentMatch(request: Hub.ActionRequest, match: any) {
  const segmentCallSpy = sinon.spy()
  const stubClient = sinon.stub(action as any, "segmentClientFromRequest")
    .callsFake(() => {
      return {identify: segmentCallSpy, flush: (cb: () => void) => cb()}
     })
  const stubAnon = sinon.stub(action as any, "generateAnonymousId").callsFake(() => "stubanon")
  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(segmentCallSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
    stubAnon.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("taggedFields", () => {

    it("returns tagged fields and field", () => {
      const fields = [
        {name: "coolemail", tags: ["email"]},
        {name: "coolid", tags: ["user_id"]},
        {name: "coolanonymousid", tags: ["segment_anonymous_id"]},
        {name: "coolnontagged"},
        {name: "coolweirdtag", tags: ["xyz"]},
      ]
      chai.expect(action.taggedFields(fields, ["email"])).deep.equals([{name: "coolemail", tags: ["email"]}])
      chai.expect(action.taggedField(fields, ["email"])).deep.equals({name: "coolemail", tags: ["email"]})
    })

    it("returns one of multiple tags", () => {
      const fields = [
        {name: "coolemail", tags: ["email"]},
        {name: "coolanonymousid", tags: ["segment_anonymous_id"]},
        {name: "coolnontagged"},
        {name: "coolweirdtag", tags: ["xyz"]},
      ]
      const tags = ["user_id", "segment_anonymous_id"]
      chai.expect(action.taggedFields(fields, tags)).deep.equals([{
        name: "coolanonymousid", tags: ["segment_anonymous_id"],
      }])
      chai.expect(action.taggedField(fields, tags)).deep.equals({
        name: "coolanonymousid", tags: ["segment_anonymous_id"],
      })
    })
  })

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json")
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json")
    })

    it("errors if the query response has no fields", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {wrong: true}}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if the query response is has no data", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {fields: []}}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if there is no tagged field", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {fields: [{}], data: []}}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged email or user_id or segment_anonymous_id.")
    })

    it("errors if there is no write key", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [],
      }}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("You must pass your Segment project's write key.")
    })

    it("works with user_id", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "funvalue",
        anonymousId: null,
      })
    })

    it("works with email", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["email"]}],
        data: [{coolfield: {value: "funvalue"}}],
      }}
      return expectSegmentMatch(request, {
        anonymousId: "stubanon",
        userId: null,
        traits: {email: "funvalue"},
       })
    })

    it("works with email and user id", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolemail", tags: ["email"]}, {name: "coolid", tags: ["user_id"]}],
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "id",
        traits: {email: "email@email.email"},
        anonymousId: null,
      })
    })

    it("works with email, user id and anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "coolanonymousid", tags: ["segment_anonymous_id"]}],
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}, coolanonymousid: {value: "anon_id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "id",
        traits: {email: "email@email.email"},
        anonymousId: "anon_id",
      })
    })

    it("works with email, user id and anonymous id and trait", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "coolanonymousid", tags: ["segment_anonymous_id"]},
          {name: "cooltrait"},
        ],
        data: [{
          coolemail: {value: "emailemail"},
          coolid: {value: "id"},
          coolanonymousid: {value: "anon_id"},
          cooltrait: {value: "funtrait"},
        }],
      }}
      return expectSegmentMatch(request, {
        userId: "id",
        traits: {
          email: "emailemail",
          cooltrait: "funtrait",
        },
        anonymousId: "anon_id",
      })
    })

    it("works with user id and anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolid", tags: ["user_id"]}, {name: "coolanonymousid", tags: ["segment_anonymous_id"]}],
        data: [
            {coolid: {value: "id"}, coolanonymousid: {value: "anon_id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "id",
        anonymousId: "anon_id",
      })
    })

    it("works with anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [
            {name: "coolanonymousid", tags: ["segment_anonymous_id"]}],
        data: [{coolanonymousid: {value: "anon_id"}}],
      }}
      return expectSegmentMatch(request, {
        userId: "anon_id",
        anonymousId: "anon_id",
      })
    })

    it("doesn't send hidden fields", () => {
      const request = new Hub.ActionRequest()
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
        traits: {email: "funvalue"},
       })
    })

    it("works with null user_ids", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [{coolfield: {value: null}}],
      }}
      return expectSegmentMatch(request, {
        userId: null,
        anonymousId: "stubanon",
      })
    })

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(action.hasForm).equals(false)
    })
  })

})
