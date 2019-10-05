import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"
import { SlackAction } from "./slack"
import * as utils from "./utils"

const action = new SlackAction()

describe(`${action.constructor.name} unit tests`, () => {

  describe("form", () => {

    it("has form", () => {
      chai.expect(action.hasForm).equals(true)
    })
  })

  describe("oauthCheck", () => {
    it("returns error if the user hasn't authed yet - no state_json", () => {
      const request = new Hub.ActionRequest()
      const form = action.oauthCheck(request)

      return chai.expect(form).to.eventually.deep.equal({
        fields: [],
        error: "You must connect to a Slack workspace first.",
      })
    })

    it("returns error if the user hasn't authed yet - invalid auth", (done) => {
      const request = new Hub.ActionRequest()
      request.params = { state_json: "someToken" }
      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
          .callsFake(() => ({
            auth: {
              test: () => { throw Error("An API error occurred: invalid_auth") },
            },
          }))
      const form = action.oauthCheck(request)

      chai.expect(form).to.eventually.deep.equal({
        fields: [],
        error: "Your Slack authentication credentials are not valid.",
      }).and.notify(stubClient.restore).and.notify(done)
    })

    it("returns user logged in info", (done) => {
      const request = new Hub.ActionRequest()
      request.params = { state_json: "someToken" }

      const stubClient = sinon.stub(action as any, "slackClientFromRequest")
          .callsFake(() => ({
            auth: {
              test: () => ({
                ok: true,
                team: "Some Team",
                team_id: "some_team_id",
              }),
            },
          }))

      const form = action.oauthCheck(request)

      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          name: "Connected",
          type: "message",
          value: `Connected with Some Team (some_team_id)`,
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })
  })

  describe("validateAndFetchForm", () => {
    it("calls oauthCheck", () => {
      const request = new Hub.ActionRequest()
      const stubOauthCheck = sinon.spy(() => ({fields: [], error: "flooby"}))

      sinon.stub(action as any, "oauthCheck").callsFake(stubOauthCheck)

      const form = action.validateAndFetchForm(request)

      chai.expect(stubOauthCheck).to.be.calledWith(request)

      return chai.expect(form).to.eventually.deep.equal({fields: [], error: "flooby"})
    })
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

    it("returns error message when getDisplayedFormFields throws and state_url is empty", () => {
      getDisplayedFormFieldsStub = sinon.stub(utils, "getDisplayedFormFields").rejects()

      const request = new Hub.ActionRequest()

      const form = action.form(request)

      return chai.expect(form).to.eventually.deep.equal({
        fields: [],
        error: "Illegal State: state_url is empty.",
      })
    })

    it("returns log in link when we can't fetch form and state_url is valid", () => {
      getDisplayedFormFieldsStub = sinon.stub(utils, "getDisplayedFormFields").rejects()

      const request = new Hub.ActionRequest()

      request.params.state_url = "/flooby"

      const form = action.form(request)

      return chai.expect(form).to.eventually.deep.equal({
        state: {},
        fields: [{
          name: "login",
          type: "oauth_link",
          label: "Log in",
          description: "In order to send to a file, you will need to log in to your Slack account.",
          oauth_url: "/flooby",
        }],
      })
    })
  })
})
