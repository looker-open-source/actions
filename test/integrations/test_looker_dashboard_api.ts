import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { LookerDashboardAPIIntegration } from "../../src/integrations/looker_dashboard_api"
import {ISendGridEmail} from "../../src/integrations/sendgrid"

const integration = new LookerDashboardAPIIntegration()

async function expectLookerAPIActionMatch(request: D.DataActionRequest, lookerUrl: string, msg: ISendGridEmail) {

  const stubGeneratePDFDashboard = sinon.stub(integration as any, "generatePDFDashboard")
    .returns(Promise.resolve("pdf content"))
  const stubSendEmail = sinon.stub(integration as any, "sendEmailAsync")
    .returns(Promise.resolve(true))

  const postAsyncSpy = sinon.spy(async () => Promise.resolve({
    id: "render_id",
  }))
  const getAsyncSpy = sinon.spy(async () => Promise.resolve({
    status: "success",
    body: "pdf content",
  }))
  const stubClient = sinon.stub(integration as any, "lookerClientFromRequest")
  .callsFake(() => ({
    postAsync: postAsyncSpy,
    getAsync: getAsyncSpy,
  }))
  const action = integration.action(request)
  const client = await integration.lookerClientFromRequest(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(stubGeneratePDFDashboard).to.have.been.calledWithMatch(client, lookerUrl)
    chai.expect(stubSendEmail).to.have.been.calledWithMatch(request, msg)
    stubGeneratePDFDashboard.restore()
    stubSendEmail.restore()
    stubClient.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no attachment for query", () => {
      const request = new D.DataActionRequest()
      request.type = "query"

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("calls render, waits and returns response.body", async () => {
      const postAsyncSpy = sinon.spy(async () => Promise.resolve({
        id: "render_id",
      }))
      const getAsyncSpy = sinon.spy(async () => Promise.resolve({
        status: "success",
        body: "pdf content",
      }))

      const stubClient = sinon.stub(integration as any, "lookerClientFromRequest")
        .callsFake(() => ({
          postAsync: postAsyncSpy,
          getAsync: getAsyncSpy,
        }))

      const request = new D.DataActionRequest()
      const client = await integration.lookerClientFromRequest(request)
      const dashboard = integration.generatePDFDashboard(client, "/dashboards/1?myfield=Yes")
      return chai.expect(dashboard).to.be.fulfilled.then(() => {
        chai.expect(postAsyncSpy).to.have.been.calledWithMatch(
          "/render_tasks/dashboards/1/pdf?width=1280&height=1",
          {
            dashboard_style: "tiled",
            dashboard_filters: "myfield=Yes",
          },
        )
        chai.expect(getAsyncSpy.firstCall).to.have.been.calledWithMatch("/render_tasks/render_id")
        chai.expect(getAsyncSpy.secondCall).to.have.been.calledWithMatch("/render_tasks/render_id/results")

        stubClient.restore()
      })
    })

    it("sends right params for query", async () => {
      const request = new D.DataActionRequest()
      request.type = "query"
      request.params = {
        base_url: "https://mycompany.looker.com:19999/api/3.0",
      }
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.formParams = {
        email: "test@example.com",
      }
      request.attachment = {dataJSON: {
        fields: [{name: "coolfield", tags: ["looker_dashboard_url"]}],
        data: [
          {coolfield: {value: "/dashboards/1?myfield=Yes"}},
        ],
      }}
      const url = "https://mycompany.looker.com/dashboards/1?myfield=Yes"
      const msg = {
        to: request.formParams.email!,
        subject: request.scheduledPlan.title!,
        from: "Looker <noreply@lookermail.com>",
        html: `<p><a href="${url}">View this data in Looker</a></p><p>Results are attached</p>`,
        attachments: [{
          content: "pdf content",
          filename: "Hello attachment_0.pdf",
        }],
      }

      return expectLookerAPIActionMatch(request, "/dashboards/1?myfield=Yes", msg)
    })

    it("errors if there is no attachment for cell", () => {
      const request = new D.DataActionRequest()
      request.type = "cell"

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Couldn't get data from attachment.")
    })

    it("sends right params for cell", async () => {
      const request = new D.DataActionRequest()
      request.type = "cell"
      request.params = {
        base_url: "https://mycompany.looker.com:19999/api/3.0",
        value: "/dashboards/1?myfield=Yes",
      }
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.formParams = {
        email: "test@example.com",
      }
      const url = "https://mycompany.looker.com/dashboards/1?myfield=Yes"
      const msg = {
        to: request.formParams.email!,
        subject: request.scheduledPlan.title!,
        from: "Looker <noreply@lookermail.com>",
        html: `<p><a href="${url}">View this data in Looker</a></p><p>Results are attached</p>`,
        attachments: [{
          content: "pdf content",
          filename: "Hello attachment_0.pdf",
        }],
      }
      return expectLookerAPIActionMatch(request, "/dashboards/1?myfield=Yes", msg)
    })

  })

  describe("form", () => {

    it("doesn't have form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

  })

})
