import * as chai from "chai"
import * as sinon from "sinon"

import * as D from "../../src/framework"

import { SendGridIntegration } from "../../src/integrations/sendgrid"

const integration = new SendGridIntegration()

const stubFilename = "stubSuggestedFilename"

function expectSendGridMatch(request: D.ActionRequest, match: any) {

  const sendSpy = sinon.spy(async () => Promise.resolve())

  const stubClient = sinon.stub(integration as any, "sgMailClientFromRequest")
    .callsFake(() => ({
      send: sendSpy,
    }))

  const stubSuggestedFilename = sinon.stub(request as any, "suggestedFilename")
    .callsFake(() => stubFilename)

  const action = integration.action(request)
  return chai.expect(action).to.be.fulfilled.then(() => {
    chai.expect(sendSpy).to.have.been.calledWithMatch(match)
    stubClient.restore()
    stubSuggestedFilename.restore()
  })
}

describe(`${integration.constructor.name} unit tests`, () => {

  describe("action", () => {

    it("errors if there is no email address", () => {
      const request = new D.ActionRequest()
      request.formParams = {}
      request.attachment = {}
      request.attachment.dataBuffer = Buffer.from("1,2,3,4", "utf8")

      const action = integration.action(request)

      return chai.expect(action).to.eventually
        .be.rejectedWith("Needs a valid email address.")
    })

    it("errors if the input has no attachment", () => {
      const request = new D.ActionRequest()
      request.formParams = {
        to: "test@example.com",
      }

      return chai.expect(integration.action(request)).to.eventually
        .be.rejectedWith("Couldn't get data from attachment")
    })

    it("sends right body to filename and address", () => {
      const request = new D.ActionRequest()
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.formParams = {
        to: "test@example.com",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}

      const msg = {
        to: request.formParams.to,
        subject: request.scheduledPlan.title,
        from: "Looker <noreply@lookermail.com>",
        text: `View this data in Looker. ${request.scheduledPlan.url}\n Results are attached.`,
        html: `<p><a href="${request.scheduledPlan.url}">View this data in Looker.</a></p><p>Results are attached.</p>`,
        attachments: [{
          content: request.attachment.dataBuffer!.toString(request.attachment.encoding),
          filename: stubFilename,
        }],
      }

      return expectSendGridMatch(request, msg)
    })

    it("sends to right filename if specified", () => {
      const request = new D.ActionRequest()
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.formParams = {
        to: "test@example.com",
        filename: "mywackyfilename",
      }
      request.attachment = {dataBuffer: Buffer.from("1,2,3,4", "utf8")}

      const msg = {
        to: request.formParams.to,
        subject: "Hello attachment",
        from: "Looker <noreply@lookermail.com>",
        text: `View this data in Looker. ${request.scheduledPlan.url}\n Results are attached.`,
        html: `<p><a href="${request.scheduledPlan.url}">View this data in Looker.</a></p><p>Results are attached.</p>`,
        attachments: [{
          content: request.attachment.dataBuffer!.toString(request.attachment.encoding),
          filename: request.formParams.filename!,
        }],
      }

      return expectSendGridMatch(request, msg)
    })

    it("sends from right email if specified", () => {
      const request = new D.ActionRequest()
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.formParams = {
        to: "test@example.com",
        filename: "mywackyfilename",
        subject: "mysubject",
      }
      request.attachment = { dataBuffer: Buffer.from("1,2,3,4", "utf8") }

      const msg = {
        to: request.formParams.to,
        subject: request.formParams.subject,
        from: "Looker <noreply@lookermail.com>",
        text: `View this data in Looker. ${request.scheduledPlan.url}\n Results are attached.`,
        html: `<p><a href="${request.scheduledPlan.url}">View this data in Looker.</a></p><p>Results are attached.</p>`,
        attachments: [{
          content: request.attachment.dataBuffer!.toString(request.attachment.encoding),
          filename: request.formParams.filename!,
        }],
      }

      return expectSendGridMatch(request, msg)
    })

    it("sends with right subject if specified", () => {
      const request = new D.ActionRequest()
      request.scheduledPlan = {
        title: "Hello attachment",
        url: "https://mycompany.looker.com/look/1",
      }
      request.formParams = {
        to: "test@example.com",
        from: "from@example.com",
        filename: "mywackyfilename",
        subject: "mysubject",
      }
      request.attachment = { dataBuffer: Buffer.from("1,2,3,4", "utf8") }

      const msg = {
        to: request.formParams.to,
        subject: request.formParams.subject,
        from: request.formParams.from,
        text: `View this data in Looker. ${request.scheduledPlan.url}\n Results are attached.`,
        html: `<p><a href="${request.scheduledPlan.url}">View this data in Looker.</a></p><p>Results are attached.</p>`,
        attachments: [{
          content: request.attachment.dataBuffer!.toString(request.attachment.encoding),
          filename: request.formParams.filename!,
        }],
      }

      return expectSendGridMatch(request, msg)
    })

  })

  describe("form", () => {

    it("has form", () => {
      chai.expect(integration.hasForm).equals(true)
    })

  })

})
