import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { DigitalOceanDropletIntegration } from "./digitalocean_droplet"

const integration = new DigitalOceanDropletIntegration()

function expectDigitalOceanDropletActionMatch(request: D.ActionRequest, ...match: any[]) {

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
    chai.expect(dropletsRequestActionSpy.firstCall).to.have.been.calledWithMatch(...match)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no attachment for query", () => {
      const request = new D.ActionRequest()
      request.type = "query"
      request.params = {
        digitalocean_api_key: "mykey",
      }

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for query", () => {
      const request = new D.ActionRequest()
      request.type = "query"
      request.params = {
        digitalocean_api_key: "mykey",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["digitalocean_droplet_id"]}],
        data: [
          {coolfield: {value: "12345"}},
        ],
      }}
      return expectDigitalOceanDropletActionMatch(request, 12345, {type: "power_off"})
    })

    it("errors if there is no attachment for cell", () => {
      const request = new D.ActionRequest()
      request.type = "cell"
      request.params = {
        digitalocean_api_key: "mykey",
      }

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for cell", () => {
      const request = new D.ActionRequest()
      request.type = "cell"
      request.params = {
        digitalocean_api_key: "mykey",
        value: "12345",
      }
      return expectDigitalOceanDropletActionMatch(request, 12345, {type: "power_off"})
    })

  })

  describe("form", () => {

    it("doesn't have form", () => {
      chai.expect(integration.hasForm).equals(false)
    })

  })

})
