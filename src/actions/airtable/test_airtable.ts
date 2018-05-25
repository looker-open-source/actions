import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { AirtableAction } from "./airtable"

const action = new AirtableAction()

function expectWebhookMatch(
  request: Hub.ActionRequest,
  base: any,
  table: any,
  match: any,
) {
  const createSpy = sinon.spy((params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${params}`)
  })
  const tableSpy = sinon.spy(() => ({create: createSpy}))
  const baseSpy = sinon.spy(() => (tableSpy))

  const stubPost = sinon.stub(action as any, "airtableClientFromRequest")
    .callsFake(() => ({
      base: baseSpy,
    }))

  const validateAndExecute = action.validateAndExecute(request)
  return chai.expect(validateAndExecute).to.be.fulfilled.then(() => {
    chai.expect(baseSpy).to.have.been.calledWith(base)
    chai.expect(tableSpy).to.have.been.calledWith(table)
    chai.expect(createSpy).to.have.been.calledWith(match)
    stubPost.restore()
  })
}

describe(`${action.constructor.name} unit tests`, () => {

  describe.only("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        airtable_api_key: "mykey",
      }
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith(
          "A streaming action was sent incompatible data. The action must have a download url or an attachment.")
    })

    it("errors if there is no url", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        airtable_api_key: "mykey",
      }
      request.formParams = {}
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {
          dimensions: [
            {name: "coolview.coolfield", label_short: "cool field", tags: ["user_id"]},
          ],
        },
        data: [{"coolview.coolfield": {value: "funvalue"}}],
      }))}
      return chai.expect(action.validateAndExecute(request)).to.eventually
        .be.rejectedWith("Missing Airtable base or table.")
    })

    it("sends right body", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        airtable_api_key: "mykey",
      }
      request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {
          dimensions: [
            {name: "coolview.coolfield", tags: ["user_id"]},
          ],
        },
        data: [{"coolview.coolfield": {value: "funvalue"}}],
      }))}
      return expectWebhookMatch(request,
        request.formParams.base,
        request.formParams.table,
        {"coolview.coolfield": "funvalue"})
    })

    it("sends right body with label_short if present", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        airtable_api_key: "mykey",
      }
      request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {
          dimensions: [{
            name: "coolview.coolfield",
            label_short: "cool field",
            label: "coolview coolfield",
            tags: ["user_id"],
          }],
        },
        data: [{"coolview.coolfield": {value: "funvalue"}}],
      }))}
      return expectWebhookMatch(request,
        request.formParams.base,
        request.formParams.table,
        {"cool field": "funvalue"})
    })

    it("returns failure on airtable create error", () => {
      const request = new Hub.ActionRequest()
      request.type = Hub.ActionType.Query
      request.params = {
        airtable_api_key: "mykey",
      }
      request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {dataBuffer: Buffer.from(JSON.stringify({
        fields: {
          dimensions: [
            { name: "coolview.coolfield", tags: ["user_id"] },
          ],
        },
        data: [{ "coolview.coolfield": { value: "funvalue" } }],
      }))}
      const tableSpy = sinon.spy(() => ({
        create: (_rec: any, cb: (err: any) => void) => {
          cb({
            type: "TABLE_NOT_FOUND",
            message: "Could not find table Contacts123 in application app",
          })
        },
      }))
      const baseSpy = sinon.spy(() => (tableSpy))

      const stubPost = sinon.stub(action as any, "airtableClientFromRequest")
        .callsFake(() => ({
          base: baseSpy,
        }))
      return chai.expect(action.validateAndExecute(request)).to.eventually.deep.equal({
        success: false,
        message: "Could not find table Contacts123 in application app",
        refreshQuery: false,
        validationErrors: [],
      }).and.notify(stubPost.restore)
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with base and table param", (done) => {
      const request = new Hub.ActionRequest()
      const form = action.validateAndFetchForm(request)
      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Airtable Base",
          name: "base",
          required: true,
          type: "string",
        }, {
          label: "Airtable Table",
          name: "table",
          required: true,
          type: "string",
        }],
      }).and.notify(done)
    })
  })
})
