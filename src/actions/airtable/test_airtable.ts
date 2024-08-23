import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import * as b64 from "base64-url"
import * as gaxios from "gaxios"
import {ActionCrypto} from "../../hub"
import { AirtableAction } from "./airtable"

const action = new AirtableAction()

function expectWebhookMatch(
  request: Hub.ActionRequest,
  base: any,
  table: any,
  match: any,
  resp: any,
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

  const execute = action.execute(request)
  return chai.expect(execute).to.be.fulfilled.then((result) => {
    stubPost.restore()
    chai.expect(baseSpy).to.have.been.calledWith(base)
    chai.expect(tableSpy).to.have.been.calledWith(table)
    chai.expect(createSpy).to.have.been.calledWith(match)
    chai.expect(result).to.deep.equal(resp)
  })
}

describe(`${action.constructor.name} unit tests`, () => {
  let encryptStub: any
  let decryptStub: any
  let gaxiosStub: any

  beforeEach(() => {
    encryptStub = sinon.stub(ActionCrypto.prototype, "encrypt").callsFake( async (s: string) => b64.encode(s) )
    decryptStub = sinon.stub(ActionCrypto.prototype, "decrypt").callsFake( async (s: string) => b64.decode(s) )
    gaxiosStub =  sinon.stub(gaxios, "request")
  })

  afterEach(() => {
    encryptStub.restore()
    decryptStub.restore()
    gaxiosStub.restore()
  })

  describe("action", () => {

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("No attached json.")
    })

    it("errors if there is no url", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {}
      request.attachment = {dataJSON: {
        fields: {
          dimensions: [
            {name: "coolview.coolfield", label_short: "cool field", tags: ["user_id"]},
          ],
        },
        data: [{"coolview.coolfield": {value: "funvalue"}}],
      }}
      return chai.expect(action.execute(request)).to.eventually
        .be.rejectedWith("Missing Airtable base or table.")
    })

    it("errors if there is no fields in dataJSON", () => {
      const request = new Hub.ActionRequest()
      request.formParams = request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {dataJSON: {
          data: [{"coolview.coolfield": {value: "funvalue"}}],
        }}
      return chai.expect(action.execute(request)).to.eventually
          .be.rejectedWith("Request payload is an invalid format.")
    })

    it("errors if there is no data in dataJSON", () => {
      const request = new Hub.ActionRequest()
      request.formParams = request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {dataJSON: {
          fields: {
            dimensions: [
              {name: "coolview.coolfield", label_short: "cool field", tags: ["user_id"]},
            ],
          },
        }}
      return chai.expect(action.execute(request)).to.eventually
          .be.rejectedWith("Request payload is an invalid format.")
    })

    it("sends right body", () => {
      const request = new Hub.ActionRequest()
      request.params.state_json = "{\"tokens\": {\"refresh_token\": \"lol\",\"access_token\":\"test\"}}"
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
        {"coolview.coolfield": "funvalue"},
          {
            refreshQuery: false,
            state: {
              data: "{\"tokens\":{\"refresh_token\":\"lol\",\"access_token\":\"test\"}}",
            },
            success: true,
            validationErrors: [],
          },
      )
    })

    it("sends right body with label_short if present", () => {
      const request = new Hub.ActionRequest()
      request.params.state_json = "{\"tokens\": {\"refresh_token\": \"lol\",\"access_token\":\"test\"}}"
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
        {"cool field": "funvalue"},
          {
            refreshQuery: false,
            state: {
              data: "{\"tokens\":{\"refresh_token\":\"lol\",\"access_token\":\"test\"}}",
            },
            success: true,
            validationErrors: [],
          },
      )
    })

    it("returns failure on airtable create error", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.attachment = {
        dataJSON: {
          fields: {
            dimensions: [
              { name: "coolview.coolfield", tags: ["user_id"] },
            ],
          },
          data: [{ "coolview.coolfield": { value: "funvalue" } }],
        },
      }
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
      return chai.expect(action.execute(request)).to.eventually.deep.equal({
        success: false,
        message: "Could not find table Contacts123 in application app",
        refreshQuery: false,
        state: {},
        validationErrors: [],
      }).then(() => {
        stubPost.restore()
      })
    })

    it("refreshes on oauth failure", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        base: "mybase",
        table: "mytable",
      }
      request.params.state_json = "{\"tokens\": {\"refresh_token\": \"lol\",\"access_token\":\"test\"}}"
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
          {"coolview.coolfield": "funvalue"},
          {
            refreshQuery: false,
            state: {
              data: "{\"tokens\":{\"refresh_token\":\"lol\",\"access_token\":\"test\"}}",
            },
            success: true,
            validationErrors: [],
          },
      )
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })

    it("has form with base and table param", (done) => {
      const request = new Hub.ActionRequest()
      request.params.state_json = "{\"tokens\":{\"refresh_token\":\"token\"}}"
      gaxiosStub.resolves({data: {access_token: "test", refresh_token: "lol"}} as any)

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
        state: {
          data: "{\"tokens\":{\"refresh_token\":\"token\"}}",
        },
      }).and.notify(done)
    })

    it("succeeds after failing oauth once", (done) => {
      const request = new Hub.ActionRequest()
      request.params.state_json = "{\"tokens\": {\"refresh_token\": \"token\"}}"
      gaxiosStub
          .onCall(0)
          .throws("oauthTestFailure")
          .onCall(1)
          .resolves({data: {access_token: "test", refresh_token: "lol"}} as any)
          .onCall(2)
          .resolves({data: "responseToCheckBaseList"})

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
        state: {
          data: "{\"tokens\":{\"refresh_token\":\"lol\",\"access_token\":\"test\"}}",
        },
      }).and.notify(done)
    })
  })
})
