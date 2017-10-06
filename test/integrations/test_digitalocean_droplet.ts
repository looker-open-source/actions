import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { DigitalOceanDropletIntegration } from "../../src/integrations/digitalocean/digitalocean_droplet"

const integration = new DigitalOceanDropletIntegration()

function expectDigitalOceanDropletActionMatch(request: D.DataActionRequest, ...match: any[]) {

  const dropletsRequestActionSpy = sinon.spy(
    (dropletId: string, params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully called with ${dropletId} ${params}`)
  })
  const stubClient = sinon.stub(integration as any, "digitalOceanClientFromRequest")
    .callsFake(() => ({
      dropletsRequestAction: dropletsRequestActionSpy,
    }))
  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(dropletsRequestActionSpy).to.have.been.calledWithMatch(...match)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no attachment for query", () => {
      const request = new D.DataActionRequest()
      request.type = "query"
      request.params = {
        digitalocean_api_key: "mykey",
      }

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for query", () => {
      const request = new D.DataActionRequest()
      request.type = "query"
      request.params = {
        digitalocean_api_key: "mykey",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["digitalocean_droplet_id"]}],
        data: [
          {coolfield: {value: "funvalue"}},
          {coolfield: {value: "funvalue1"}},
        ],
      }}
      return expectDigitalOceanDropletActionMatch(request, "funvalue", {type: "power_off"})
    })

    it("errors if there is no attachment for cell", () => {
      const request = new D.DataActionRequest()
      request.type = "cell"
      request.params = {
        digitalocean_api_key: "mykey",
      }

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for cell", () => {
      const request = new D.DataActionRequest()
      request.type = "cell"
      request.params = {
        digitalocean_api_key: "mykey",
        value: "funvalue",
      }
      return expectDigitalOceanDropletActionMatch(request, "funvalue", {type: "power_off"})
    })

  })

  describe("form", () => {

    it("doesn't have form", () => {
      chai.expect(integration.hasForm).equals(false)
    })

  })

})
