import * as chai from "chai"
import * as sinon from "sinon"

import * as Hub from "../../hub"

import { WorkplaceAction } from "./workplace"

const integration = new WorkplaceAction()

describe(`${integration.constructor.name} unit tests`, () => {

  describe("execute", () => {

    it("errors if there is no destination", () => {
      const request = new Hub.ActionRequest()
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}

      const execute = integration.execute(request)

      return chai.expect(execute).to.eventually
        .be.rejectedWith("Missing destination.")
    })

    it("errors if the input has no attachment", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        destination: "destination",
      }

      return chai.expect(integration.execute(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends to right link, destination and message if specified", () => {
      const request = new Hub.ActionRequest()
      request.formParams = {
        destination: "mygroup",
        message: "message",
      }
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.attachment = {
        dataBuffer: Buffer.from("1,2,3,4", "utf8"),
        fileExtension: "png",
      }
      const apiStub = sinon.stub()
      apiStub.withArgs(`/${request.formParams.destination}/photos`).returns({ id: "myphoto" })

      const stubClient = sinon.stub(integration as any, "facebookClientFromRequest")
        .callsFake(() => ({
          api: apiStub,
        }))

      const execute = integration.execute(request)
      return chai.expect(execute).to.be.fulfilled.then(() => {
        chai.expect(apiStub.firstCall).to.have.been.calledWithMatch(`/mygroup/photos`, "post", {
          source: request.attachment!.dataBuffer,
        })
        chai.expect(apiStub.secondCall).to.have.been.calledWithMatch(`/mygroup/feed`, "post", {
          message: request.formParams.message,
          link: request.scheduledPlan!.url,
          attached_media: [{
            media_fbid: "myphoto",
          }],
        })
        stubClient.restore()
      })
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

    it("has form with correct destinations", (done) => {

      const apiStub = sinon.stub()
      apiStub.withArgs("/community").returns({id: "mycommunity"})
      apiStub.withArgs("/mycommunity/groups").returns({
        data: [
          {id: "1", name: "A"},
          {id: "2", name: "B"},
        ],
      })

      const stubClient = sinon.stub(integration as any, "facebookClientFromRequest")
        .callsFake(() => ({
          api: apiStub,
        }))

      const request = new Hub.ActionRequest()
      const form = integration.validateAndFetchForm(request)

      chai.expect(form).to.eventually.deep.equal({
        fields: [{
          description: "Name of the Facebook group you would like to post to.",
          label: "Share In",
          name: "destination",
          options: [
            {name: "1", label: "#A"},
            {name: "2", label: "#B"},
          ],
          required: true,
          type: "select",
        }, {
          label: "Message",
          type: "string",
          name: "message",
        }],
      }).and.notify(stubClient.restore).and.notify(done)
    })

  })

})
