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
        url: "url",
        clientID: "clientID",
        clientSecret: "clientSecret",
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(
          "A streaming action was sent incompatible data. The action must have a download url or an attachment.")
    })

    it("errors if there is no campaign ID", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        url: "url",
        clientID: "clientID",
        clientSecret: "clientSecret",
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

    it("sends all the data to Marketo", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        url: "url",
        clientID: "clientID",
        clientSecret: "clientSecret",
      }
      request.formParams = {campaignID: "1243"}
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {
          measures: [],
          dimensions: [
            {label_short: "ID", name: "users.id", tags: ["user_id", "marketo:Account__c"]},
            {label_short: "Email", name: "users.email", tags: ["email", "marketo:email"]},
            {label_short: "Gender", name: "users.gender", tags: ["marketo:NPS_Role__c"]},
        ]},
        data: [
          {
            "users.id": {value: 4653},
            "users.email": {value: "zoraida.gregoire@gmail.com"},
            "users.gender": {value: "f"},
          },
          {
            "users.id": {value: 629},
            "users.email": {value: "zola.summers@gmail.com"},
            "users.gender": {value: "f"},
          },
          {"users.id": {value: 6980},
            "users.email": {value: "zoe.brady@gmail.com"},
            "users.gender": {value: "f"},
          },
        ],
      }))}

      const leadSpy = sinon.spy(() => {
        return {result: [{id: 1}, {id: 2}, {id: 3}]}
      })
      const requestSpy = sinon.spy(() => {
        return "boomdaboom"
      })

      sinon.stub(action as any, "marketoClientFromRequest").callsFake(() => {
        return {
          lead: {
            createOrUpdate: leadSpy,
          },
          campaign: {
            request: requestSpy,
          },
        }
      })
      const validateAndExecute = action.validateAndExecute(request)
      return chai.expect(validateAndExecute).to.be.fulfilled.then(() => {
        chai.expect(leadSpy).to.have.been.calledWith()
        chai.expect(requestSpy).to.have.been.calledWith()
      })
    })
  })
})
