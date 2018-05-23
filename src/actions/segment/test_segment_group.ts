import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import { SegmentGroupAction } from "./segment_group"

const action = new SegmentGroupAction()

function expectSegmentMatch(request: Hub.ActionRequest, match: any) {
  const groupSpy = sinon.spy()
  const stubClient = sinon.stub(action as any, "segmentClientFromRequest")
    .callsFake(() => {
      return { group: groupSpy, flush: (cb: () => void) => cb()}
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
    chai.expect(groupSpy).to.have.been.calledWithExactly(merged)
    stubClient.restore()
    stubAnon.restore()
    stubNow.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("works with segment_group_id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{ name: "coolfield", tags: ["segment_group_id"]}]},
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      return expectSegmentMatch(request, {
        groupId: "funvalue",
        anonymousId: "stubanon",
        userId: null,
      })
    })

    it("works with segment_group_id and user_id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{ name: "coolfield", tags: ["segment_group_id"]}, {name: "coolid", tags: ["user_id"]}]},
        data: [{ coolfield: { value: "funvalue"}, coolid: {value: "id"}}],
      }))}
      return expectSegmentMatch(request, {
        groupId: "funvalue",
        userId: "id",
        anonymousId: null,
      })
    })

    it("works with segment_group_id, user id and email", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolfield", tags: ["segment_group_id"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "coolanonymousid", tags: ["segment_anonymous_id"]},
          {name: "cooltrait"},
        ]},
        data: [{
          coolemail: {value: "emailemail"},
          coolfield: {value: "funvalue"},
          coolid: {value: "id"},
          coolanonymousid: {value: "anon_id"},
          cooltrait: {value: "funtrait"},
        }],
      }))}
      return expectSegmentMatch(request, {
        groupId: "funvalue",
        userId: "id",
        anonymousId: "anon_id",
        traits: {
          email: "emailemail",
          cooltrait: "funtrait",
        },
      })
    })

    it("works with segment_group_id, user id and anonymous id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          { name: "coolfield", tags: ["segment_group_id"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "coolanonymousid", tags: ["segment_anonymous_id"]}]},
        data: [{ coolfield: {value: "funvalue"}, coolid: {value: "id"}, coolanonymousid: {value: "anon_id"}}],
      }))}
      return expectSegmentMatch(request, {
        groupId: "funvalue",
        userId: "id",
        anonymousId: "anon_id",
      })
    })

    it("works with segment_group_id and null user_id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        segment_write_key: "mykey",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{ name: "coolfield", tags: ["segment_group_id"]}, {name: "coolid", tags: ["user_id"]}]},
        data: [{ coolfield: { value: "funvalue"}, coolid: {value: null}}],
      }))}
      return expectSegmentMatch(request, {
        groupId: "funvalue",
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
