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
  const stubNow = sinon.stub(Date as any, "now").callsFake(() => "now")

  const baseMatch = {
    traits: {},
    context: {
      app: {
        name: "looker/actions",
        version: "dev",
      },
    },
    timestamp: "now",
  }
  const merged = {...baseMatch, ...match}

  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(segmentCallSpy).to.have.been.calledWithExactly(merged)
    stubClient.restore()
    stubAnon.restore()
    stubNow.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("works with user_id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
          fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
          data: [{coolfield: {value: "funvalue"}}],
        }))}
      return expectSegmentMatch(request, {
        userId: "funvalue",
        anonymousId: null,
      })
    })

    it("works with email", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["email"]}]},
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      return expectSegmentMatch(request, {
        anonymousId: "stubanon",
        userId: null,
        traits: {email: "funvalue"},
       })
    })

    it("works with email and user id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolemail", tags: ["email"]}, {name: "coolid", tags: ["user_id"]}]},
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}}],
      }))}
      return expectSegmentMatch(request, {
        userId: "id",
        traits: {email: "email@email.email"},
        anonymousId: null,
      })
    })

    it("works with email, user id and anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "coolanonymousid", tags: ["segment_anonymous_id"]}]},
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}, coolanonymousid: {value: "anon_id"}}],
      }))}
      return expectSegmentMatch(request, {
        userId: "id",
        traits: {email: "email@email.email"},
        anonymousId: "anon_id",
      })
    })

    it("works with email, user id and anonymous id and trait", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "coolanonymousid", tags: ["segment_anonymous_id"]},
          {name: "cooltrait"},
        ]},
        data: [{
          coolemail: {value: "emailemail"},
          coolid: {value: "id"},
          coolanonymousid: {value: "anon_id"},
          cooltrait: {value: "funtrait"},
        }],
      }))}
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
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          {name: "coolid", tags: ["user_id"]}, {name: "coolanonymousid", tags: ["segment_anonymous_id"]},
        ]},
        data: [
            {coolid: {value: "id"}, coolanonymousid: {value: "anon_id"}}],
      }))}
      return expectSegmentMatch(request, {
        userId: "id",
        anonymousId: "anon_id",
      })
    })

    it("works with anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
            {name: "coolanonymousid", tags: ["segment_anonymous_id"]},
        ]},
        data: [{coolanonymousid: {value: "anon_id"}}],
      }))}
      return expectSegmentMatch(request, {
        userId: "anon_id",
        anonymousId: "anon_id",
      })
    })

    it("doesn't send hidden fields", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {
          dimensions: [
            {name: "coolfield", tags: ["email"]},
            {name: "hiddenfield"},
            {name: "nonhiddenfield"},
          ]},
        data: [{
          coolfield: {value: "funvalue"},
          hiddenfield: {value: "hiddenvalue"},
          nonhiddenfield: {value: "nonhiddenvalue"},
        }],
      }))}
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
        traits: {
          email: "funvalue",
          nonhiddenfield: "nonhiddenvalue",
        },
      })
    })

    it("works with null user_ids", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
        data: [{coolfield: {value: null}}],
      }))}
      return expectSegmentMatch(request, {
        userId: null,
        anonymousId: "stubanon",
      })
    })

    it("works with ran_at", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["email"]}]},
        ran_at: "2017-07-28T02:25:19+00:00",
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      return expectSegmentMatch(request, {
        anonymousId: "stubanon",
        userId: null,
        timestamp: new Date("2017-07-28T02:25:19+00:00").getTime(),
        traits: {email: "funvalue"},
       })
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(
          "A streaming action was sent incompatible data. The action must have a download url or an attachment.")
    })

    it("errors if the query response has no fields", (done) => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged email or user_id or segment_anonymous_id.")
        .and.notify(done)
    })

    it("errors if there is no tagged field", (done) => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield"}]},
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged email or user_id or segment_anonymous_id.")
        .and.notify(done)
    })

    it("errors if there is no write key", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
        data: [],
      }))}
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(`Required parameter "segment_write_key" not provided.`)
    })

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(action.hasForm).equals(false)
    })
  })

})
