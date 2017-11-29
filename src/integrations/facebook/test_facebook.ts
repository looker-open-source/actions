import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../framework"

import { FacebookIntegration } from "./facebook"

const integration = new FacebookIntegration()

function expectFacebookMatch(request: D.ActionRequest, path: string, method: string, qs: any) {

  const apiSpy = sinon.spy(async () => Promise.resolve())

  const stubClient = sinon.stub(integration as any, "facebookClientFromRequest")
    .callsFake(() => ({
      api: apiSpy,
    }))

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(apiSpy).to.have.been.calledWithMatch(path, method, qs)
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no destination", () => {
      const request = new D.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Missing destination.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        destination: "destination",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends to right link, destination and message if specified", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        destination: "destination",
        message: "message",
      }
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "csv",
      }
      return expectFacebookMatch(request, `/${request.formParams.destination}/feed`, "post", {
        message: request.formParams.message,
        link: request.scheduledPlan.url,
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct destinations", (done) => {

      const apiStub = sinon.stub()
      apiStub.withArgs("/community").returns({
        community: {
          id: "community",
        },
      })
      apiStub.withArgs("/community/groups").returns({
        groups: [
          {id: "1", name: "A"},
          {id: "2", name: "B"},
        ],
      })
      apiStub.withArgs("/community/members").returns({
        members: [
          {id: "10", name: "Z"},
          {id: "20", name: "Y"},
        ],
      })

      const stubClient = sinon.stub(integration as any, "facebookClientFromRequest")
        .callsFake(() => ({
          api: apiStub,
        }))

      const request = new D.ActionRequest()
      const form = integration.validateAndFetchForm(request)

      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          description: "Name of the Facebook group you would like to post to.",
          label: "Share In",
          name: "destination",
          options: [
            {name: "1", label: "#A"},
            {name: "2", label: "#B"},
            {name: "10", label: "@Z"},
            {name: "20", label: "@Y"}],
          required: true,
          type: "select",
        }, {
          label: "Message",
          type: "string",
          name: "message",
        }],
      }).and.notify(apiStub.restore).and.notify(stubClient.restore).and.notify(done)
      // .then(() => {
      //   apiStub.restore()
      //   stubClient.restore()
      // })
    })

  })

})
