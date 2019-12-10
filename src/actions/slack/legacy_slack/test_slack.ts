import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../../hub"
import * as utils from "../utils"
import { SlackAttachmentAction } from "./slack"

const action = new SlackAttachmentAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })

  it("streaming disabled to support legacy formats", () => {
    chai.expect(action.usesStreaming).equals(false)
  })

  describe("form", () => {
    let getDisplayedFormFieldsStub: any

    afterEach(() => {
      getDisplayedFormFieldsStub && getDisplayedFormFieldsStub.restore()
    })

    it("returns fields correctly from getDisplayedFormFields", () => {
      getDisplayedFormFieldsStub = sinon.stub(utils, "getDisplayedFormFields").returns(
          Promise.resolve([
              {
                label: "Super Label",
                type: "string",
                name: "boo",
              },
          ]),
      )

      const request = new Hub.ActionRequest()

      const form = action.form(request)

      return chai.expect(form).to.eventually.deep.equal({
        fields: [{
          label: "Super Label",
          type: "string",
          name: "boo",
        }],
      })
    })

    it("returns error message", () => {
      getDisplayedFormFieldsStub = sinon.stub(utils, "getDisplayedFormFields").callsFake(() => {
        throw Error("An API error occurred: invalid_auth")
      })

      const request = new Hub.ActionRequest()

      const form = action.form(request)

      return chai.expect(form).to.eventually.deep.equal({
        fields: [],
        error: "Your Slack authentication credentials are not valid.",
      })
    })
  })

  describe("execute", () => {
    let handleExecuteStub: any

    afterEach(() => {
      handleExecuteStub && handleExecuteStub.restore()
    })

    it("returns fields correctly from getDisplayedFormFields", () => {
      const response = new Hub.ActionResponse({success: true})
      handleExecuteStub = sinon.stub(utils, "handleExecute").returns(
          Promise.resolve(response),
      )

      const request = new Hub.ActionRequest()

      const form = action.execute(request)

      return chai.expect(form).to.eventually.deep.equal(response)
    })
  })
})
