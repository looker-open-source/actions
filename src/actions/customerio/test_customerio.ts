import * as chai from "chai"
import * as sinon from "sinon"

import * as winston from "winston"
import * as Hub from "../../hub"
import { CustomerIoAction } from "./customerio"

const action = new CustomerIoAction()
action.executeInOwnProcess = false

function expectCustomerIoMatch(request: Hub.ActionRequest, match: any) {
  const customerIoCallSpy = sinon.spy(async () => Promise.resolve())
  winston.debug(match)
  const stubClient = sinon.stub(action as any, "customerIoClientFromRequest")
      .callsFake(() => {
        return {identify: customerIoCallSpy}
      })
  const currentDate = new Date()
  const clock = sinon.useFakeTimers(currentDate.getTime())
  return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
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
      // request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
      //     fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
      //     data: [{coolfield: {value: 200}}]}))}
      // return expectCustomerIoMatch(request, {
      //   id: 200,
      // })

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

    it("errors if there is no site id", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {dimensions: [{name: "coolfield", tags: ["user_id"]}]},
        data: [],
      }))}
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(`Required setting "Site ID" not specified in action settings.`)
    })

  })

  describe("form", () => {
    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })



})
