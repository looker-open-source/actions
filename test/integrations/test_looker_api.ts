import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { LookerAPIIntegration } from "../../src/integrations/looker_api"

const integration = new LookerAPIIntegration()

function expectLookerAPIActionMatch(request: D.DataActionRequest, match: any) {

  const getSpy = sinon.spy(
    (params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully called ${params}`)
  })
  const stubClient = sinon.stub(integration as any, "lookerClientFromRequest")
    .callsFake(() => ({
      getAsync: getSpy,
    }))
  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(getSpy.firstCall).to.have.been.calledWithMatch(match)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no attachment for query", () => {
      const request = new D.DataActionRequest()
      request.type = "query"
      request.params = {
        looker_api_key: "mykey",
      }

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for query", () => {
      const request = new D.DataActionRequest()
      request.type = "query"
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["looker_api_url"]}],
        data: [
          {coolfield: {value: "https://instancename.looker.com/dashboards/1"}},
        ],
      }}
      return expectLookerAPIActionMatch(request, "/dashboards/1")
    })

    it("errors if there is no attachment for cell", () => {
      const request = new D.DataActionRequest()
      request.type = "cell"

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for cell", () => {
      const request = new D.DataActionRequest()
      request.type = "cell"
      request.params = {
        value: "https://instancename.looker.com/dashboards/1",
      }
      return expectLookerAPIActionMatch(request, "/dashboards/1")
    })

  })

  describe("form", () => {

    it("doesn't have form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

  })

})
