import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { MarketoAction } from "./marketo"

const action = new MarketoAction()

describe(`${action.constructor.name} unit tests`, () => {
  describe("action", () => {
    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        url: "myurl",
        clientID: "myclientID",
        clientSecret: "myclientSecret",
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("No attached json.")
    })

    it("errors if there is no campaign ID", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        url: "myurl",
        clientID: "myclientID",
        clientSecret: "myclientSecret",
      }
      request.formParams = {}
      request.attachment = {dataJSON: {
        fields: {
          dimensions: [
            {name: "political.campaign", label_short: "chort", tags: ["sometag"]},
          ],
        },
        data: [{"some.field": {value: "value"}}],
      }}
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Missing Campaign ID.")
    })

    it("errors if there is no campaign ID", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        url: "myurl",
        clientID: "myclientID",
        clientSecret: "myclientSecret",
      }
      request.formParams = {
        campaignID: "1243",
        lookupField: "email",
      }
      request.attachment = {dataJSON: {
        fields: {
          measures: [],
          dimensions: [
            {label_short: "ID", name: "users.id", tags: ["user_id", "marketo:Account__c"]},
        ]},
        data: [
          {
            "users.id": {value: 4653},
          },
          {
            "users.id": {value: 629},
          },
          {
            "users.id": {value: 6980},
          },
        ],
      }}

      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Marketo Lookup Field for lead not present in query.")
    })

    it("sends all the data to Marketo", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        url: "myurl",
        clientID: "myclientID",
        clientSecret: "myclientSecret",
      }
      request.formParams = {
        campaignID: "1243",
        lookupField: "email",
      }
      request.attachment = {dataJSON: {
        fields: {
          measures: [],
          dimensions: [
            {label_short: "ID", name: "users.id", tags: ["user_id", "marketo:Account__c"]},
            {label_short: "Email", name: "users.email", tags: ["email", "marketo:email"]},
            {label_short: "Gender", name: "users.gender", tags: ["marketo:gender"]},
            {label_short: "random", name: "users.random"},
          ],
        },
        data: [
          {
            "users.id": {value: 4653},
            "users.email": {value: "zoraida.gregoire@gmail.com"},
            "users.gender": {value: "f"},
            "users.random": {value: 7},
          },
          {
            "users.id": {value: 629},
            "users.email": {value: "zola.summers@gmail.com"},
            "users.gender": {value: "m"},
            "users.random": {value: 4},
          },
          {
            "users.id": {value: 6980},
            "users.email": {value: "zoe.brady@gmail.com"},
            "users.gender": {value: "f"},
            "users.random": {value: 5},
          },
        ],
      }}

      const leadSpy = sinon.spy(async () => Promise.resolve({
        success: true,
        result: [{id: 1}, {id: 2}, {id: 3}],
      }))
      const requestSpy = sinon.spy(async () => Promise.resolve({
        success: true,
        result: [{id: 1}, {id: 2}, {id: 3}],
      }))

      const stubClient = sinon.stub(action as any, "marketoClientFromRequest").callsFake(() => {
        return {
          lead: {
            createOrUpdate: leadSpy,
          },
          campaign: {
            request: requestSpy,
          },
        }
      })
      return chai.expect(action.validateAndExecute(request)).to.be.fulfilled.then(() => {
        chai.expect(leadSpy).to.have.been.calledWith([
          {
            Account__c: 4653,
            email: "zoraida.gregoire@gmail.com",
            gender: "f",
          },
          {
            Account__c: 629,
            email: "zola.summers@gmail.com",
            gender: "m",
          },
          {
            Account__c: 6980,
            email: "zoe.brady@gmail.com",
            gender: "f",
          },
        ], {lookupField: "email"})
        chai.expect(requestSpy).to.have.been.calledWith("1243",
          [{id: 1}, {id: 2}, {id: 3}])
        stubClient.restore()
      })
    })

  })
})
