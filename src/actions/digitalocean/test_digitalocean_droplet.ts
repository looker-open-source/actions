import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { DigitalOceanDropletAction } from "./digitalocean_droplet"

const action = new DigitalOceanDropletAction()

function expectDigitalOceanDropletActionMatch(request: Hub.ActionRequest, ...match: any[]) {

  const dropletsRequestActionSpy = sinon.spy(
    (dropletId: string, params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully called with ${dropletId} ${params}`)
  })
  const stubClient = sinon.stub(action as any, "digitalOceanClientFromRequest")
    .callsFake(() => ({
      dropletsRequestAction: dropletsRequestActionSpy,
    }))
  return chai.expect(action.execute(request)).to.be.fulfilled.then(() => {
    chai.expect(dropletsRequestActionSpy.firstCall).to.have.been.calledWithMatch(...match)
    stubClient.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no attachment for query", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        digitalocean_api_key: "mykey",
      }

      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for query", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
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
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        digitalocean_api_key: "mykey",
      }
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for cell", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Cell
      request.params = {
        digitalocean_api_key: "mykey",
        value: "12345",
      }
      return expectDigitalOceanDropletActionMatch(request, 12345, {type: "power_off"})
    })

  })

  describe("form", () => {

    it("doesn't have form", () => {
      chai.expect(action.hasForm).equals(false)
    })

  })

})
