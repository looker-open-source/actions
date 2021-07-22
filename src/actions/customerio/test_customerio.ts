import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import * as apiKey from "../../server/api_key"
import Server from "../../server/server"
import { CustomerIoAction } from "./customerio"

const action = new CustomerIoAction()
action.executeInOwnProcess = false

function expectCustomerIoMatch(request: Hub.ActionRequest, match: any) {
  const customerIoCallSpy = sinon.spy()
  const stubClient = sinon.stub(action as any, "customerIoClientFromRequest")
      .callsFake(() => {
        return {identify: customerIoCallSpy}
      })
  const currentDate = new Date()
  const timestamp = Math.round(+currentDate / 1000)
  const clock = sinon.useFakeTimers(currentDate.getTime())

  const baseMatch = {
    context: {
      app: {
        looker_sent_at: timestamp,
        name: "looker/actions",
        version: "dev",
      },
    },
  }
  const merged = {...baseMatch, ...match}
  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
    chai.expect(customerIoCallSpy).to.have.been.calledWithExactly(merged)
    stubClient.restore()
    clock.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("works with user_id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
          fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
          data: [{coolfield: {value: 200}}]}))}
      return expectCustomerIoMatch(request, {
        id: 200,
      })
    })

    it("works with email", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["email"]}]},
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      return expectCustomerIoMatch(request, {
        userId: null,
       })
    })

    it("works with pivoted values", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
          fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}],
                   measures: [{name: "users.count"}]},
          data: [{"coolfield": {value: "funvalue"}, "users.count": {f: {value: 1}, z: {value: 3}}}],
        }))}
      return expectCustomerIoMatch(request, {
        userId: "funvalue",
        traits: { "users.count": [{ f: 1 }, { z: 3 }] },
      })
    })

    it("works with email and user id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolemail", tags: ["email"]}, {name: "coolid", tags: ["user_id"]}]},
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}}],
      }))}
      return expectCustomerIoMatch(request, {
        userId: "id",
        traits: {email: "email@email.email"},
      })
    })

    it("works with email, user id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolid", tags: ["user_id"]}]},
        data: [{coolemail: {value: "email@email.email"}, coolid: {value: "id"}}],
      }))}
      return expectCustomerIoMatch(request, {
        userId: "id",
        traits: {email: "email@email.email"},
      })
    })

    it("works with email, user id and trait", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          {name: "coolemail", tags: ["email"]},
          {name: "coolid", tags: ["user_id"]},
          {name: "cooltrait", tags: []},
        ]},
        data: [{
          coolemail: {value: "emailemail"},
          coolid: {value: "id"},
          cooltrait: {value: "funtrait"},
        }],
      }))}
      return expectCustomerIoMatch(request, {
        userId: "id",
        traits: {
          email: "emailemail",
          cooltrait: "funtrait",
        },
      })
    })

    it("works with user id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [
          {name: "coolid", tags: ["user_id"]},
        ]},
        data: [
            {coolid: {value: "id"}}],
      }))}
      return expectCustomerIoMatch(request, {
        userId: "id",
      })
    })

    it("doesn't send hidden fields", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
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
      return expectCustomerIoMatch(request, {
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
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
        data: [{coolfield: {value: null}}],
      }))}
      return expectCustomerIoMatch(request, {
        userId: null,
      })
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(
          "A streaming action was sent incompatible data. The action must have a download url or an attachment.")
    })

    it("errors if the query response has no fields", (done) => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      chai.expect(action.validateAndExecute(request)).to.eventually
        .deep.equal({
          message: "Query requires a field tagged email or user_id.",
          success: false,
          refreshQuery: false,
          validationErrors: [],
        })
        .and.notify(done)
    })

    it("errors if there is no tagged field", (done) => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        customer_io_api_key: "mykey",
        customer_io_site_id: "mysiteId",
        customer_io_region: "RegionEU",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: []}]},
        data: [{coolfield: {value: "funvalue"}}],
      }))}
      chai.expect(action.validateAndExecute(request)).to.eventually
        .deep.equal({
          message: "Query requires a field tagged email or user_id.",
          success: false,
          refreshQuery: false,
          validationErrors: [],
        })
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
        .be.rejectedWith(`Required setting "Segment Write Key" not specified in action settings.`)
    })

  })

  describe("form", () => {
    it("has no form", () => {
      chai.expect(action.hasForm).equals(false)
    })
  })

  describe("asJSON", () => {
    it("supported format is json_detail on lookerVersion 6.0 and below", (done) => {
      const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
      chai.request(new Server().app)
        .post("/actions/segment_event")
        .set("Authorization", "Token token=\"foo\"")
        .set("User-Agent", "LookerOutgoingWebhook/6.0.0")
        .end((_err, res) => {
          chai.expect(res).to.have.status(200)
          chai.expect(res.body).to.deep.include({supported_formats: ["json_detail"]})
          stub.restore()
          done()
        })
    })

    it("supported format is json_detail_lite_stream on lookerVersion 6.2 and above", (done) => {
      const stub = sinon.stub(apiKey, "validate").callsFake((k: string) => k === "foo")
      chai.request(new Server().app)
        .post("/actions/segment_event")
        .set("Authorization", "Token token=\"foo\"")
        .set("User-Agent", "LookerOutgoingWebhook/6.2.0")
        .end((_err, res) => {
          chai.expect(res).to.have.status(200)
          chai.expect(res.body).to.deep.include({supported_formats: ["json_detail_lite_stream"]})
          stub.restore()
          done()
        })
    })
  })

})
