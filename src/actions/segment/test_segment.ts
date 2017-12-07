import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"
import { SegmentAction } from "./segment"

const integration = new SegmentAction()

function expectSegmentMatch(request: D.ActionRequest, match: any) {
  const identifySpy = sinon.spy()
  const stubClient = sinon.stub(integration as any, "segmentClientFromRequest")
    .callsFake(() => {
      return {identify: identifySpy, flush: (cb: () => void) => cb()}
     })
  const stubAnon = sinon.stub(integration as any, "generateAnonymousId").callsFake(() => "stubanon")
  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(identifySpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
    stubAnon.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new D.ActionRequest()
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("No attached json")
    })

    it("errors if the query response has no fields", () => {
      const request = new D.ActionRequest()
      request.attachment = {dataJSON: {wrong: true}}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if the query response is has no data", () => {
      const request = new D.ActionRequest()
      request.attachment = {dataJSON: {fields: []}}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if there is no tagged field", () => {
      const request = new D.ActionRequest()
      request.attachment = {dataJSON: {fields: [{}], data: []}}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged email or user_id or segment_anonymous_id.")
    })

    it("errors if there is no write key", () => {
      const request = new D.ActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [],
      }}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("You must pass your Segment project's write key.")
    })

    it("works with user_id", () => {
      const request = new D.ActionRequest()
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
      const request = new D.ActionRequest()
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
      const request = new D.ActionRequest()
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
      const request = new D.ActionRequest()
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

    it("works with user id and anonymous id", () => {
      const request = new D.ActionRequest()
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
      const request = new D.ActionRequest()
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
      const request = new D.ActionRequest()
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

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(integration.hasForm).equals(false)
    })
  })

})
