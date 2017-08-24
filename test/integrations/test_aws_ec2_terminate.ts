import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"
import { SegmentIntegration } from "../../src/integrations/segment"

const integration = new SegmentIntegration()

/*
bash one-liner for generating a valid json request:
printf '%s%s%s' '{"type":"query", "data":{"segment_write_key":"foobar", "aws_access_key":"", "aws_secret_key":""}, "attachment":{"mimetype":"application/json","data":' "$(printf '{"fields":{"dimensions":[{"name":"emailFieldName","tags":["email"]}]},"data":[{"emailFieldName":{"value":"me@me.com"},"otherFieldName":{"value":"bazz"}}]}' | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()), end="")' )" '}}' | jq . | tee /dev/fd/2 | pbcopy

curl one-liner to run above json request:
pbpaste | curl -v 'localhost:8080/integrations/segment_event/action' -X POST -H 'Authorization: Token token="e920b53ed37e81c58504cb0c399c96c740c5c62fc51420335d6628d744b91ec8/d4c8b3dbf125ce2deef6fdf882eb0811da7df743279e927a1ee871c466edeb58a0f0de2084c7feb7c05b9f0e1dc1b768b30386d4562fe2cef35126f57dbcd32c"' -H "Content-Type: application/json" -d @- | jq .

*/

function expectSegmentMatch(request: D.DataActionRequest, match: any) {
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
      const request = new D.DataActionRequest()
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("No attached json")
    })

    it("errors if the query response has no fields", () => {
      const request = new D.DataActionRequest()
      request.attachment = {dataJSON: {wrong: true}}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if the query response is has no data", () => {
      const request = new D.DataActionRequest()
      request.attachment = {dataJSON: {fields: []}}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if there is no tagged field", () => {
      const request = new D.DataActionRequest()
      request.attachment = {dataJSON: {fields: [{}], data: []}}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Query requires a field tagged email or user_id or segment_anonymous_id.")
    })

    it("errors if there is no write key", () => {
      const request = new D.DataActionRequest()
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["user_id"]}],
        data: [],
      }}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("You must pass your Segment project's write key.")
    })

    it("works with user_id", () => {
      const request = new D.DataActionRequest()
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
      const request = new D.DataActionRequest()
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
      const request = new D.DataActionRequest()
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
      const request = new D.DataActionRequest()
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
      const request = new D.DataActionRequest()
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
      const request = new D.DataActionRequest()
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

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(integration.hasForm).equals(false)
    })
  })

})
