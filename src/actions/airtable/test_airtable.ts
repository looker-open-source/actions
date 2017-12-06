import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { AirtableIntegration } from "./airtable"

const integration = new AirtableIntegration()

function expectWebhookMatch(
  request: D.ActionRequest,
  base: any,
  table: any,
  match: any,
) {
  const createSpy = sinon.spy((params: any, callback: (err: any, data: any) => void) => {
    callback(null, `successfully sent ${params}`)
  })
  const tableSpy = sinon.spy(() => ({create: createSpy}))
  const baseSpy = sinon.spy(() => (tableSpy))

  const stubPost = sinon.stub(integration as any, "airtableClientFromRequest")
    .callsFake(() => ({
      base: baseSpy,
    }))

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(baseSpy).to.have.been.calledWith(base)
    chai.expect(tableSpy).to.have.been.calledWith(table)
    chai.expect(createSpy).to.have.been.calledWith(match)
    stubPost.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new D.ActionRequest()
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("No attached json.")
    })

    it("errors if there is no url", () => {
      const request = new D.ActionRequest()
      request.formParams = {}
      request.attachment = {dataJSON: {
        fields: {
          dimensions: [
            {name: "coolview.coolfield", label_short: "cool field", tags: ["user_id"]},
          ],
        },
        data: [{"coolview.coolfield": {value: "funvalue"}}],
      }}
      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Missing Airtable base or table.")
    })

    it("sends right body", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {dataJSON: {
        fields: {
          dimensions: [
            {name: "coolview.coolfield", tags: ["user_id"]},
          ],
        },
        data: [{"coolview.coolfield": {value: "funvalue"}}],
      }}
      return expectWebhookMatch(request,
        request.formParams.base,
        request.formParams.table,
        {"coolview.coolfield": "funvalue"})
    })

    it("sends right body with label_short if present", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {dataJSON: {
        fields: {
          dimensions: [{
            name: "coolview.coolfield",
            label_short: "cool field",
            label: "coolview coolfield",
            tags: ["user_id"],
          }],
        },
        data: [{"coolview.coolfield": {value: "funvalue"}}],
      }}
      return expectWebhookMatch(request,
        request.formParams.base,
        request.formParams.table,
        {"cool field": "funvalue"})
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with base and table param", (done) => {
      const request = new D.ActionRequest()
      const form = integration.validateAndFetchForm(request)
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
