import winston = require("winston")
import * as Hub from "../../hub"

import * as helpers from "@sendgrid/helpers"

const sendgridMail = require("@sendgrid/mail")

export class SendGridAction extends Hub.Action {

  name = "sendgrid"
  label = "SendGrid"
  iconName = "sendgrid/sendgrid.png"
  description = "Send data files to an email via SendGrid."
  params = [
    {
      description: "API key for SendGrid from https://app.sendgrid.com/settings/api_keys.",
      label: "SendGrid API Key",
      name: "sendgrid_api_key",
      required: true,
      sensitive: true,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]

  async execute(request: Hub.ActionRequest) {
    const response = new Hub.ActionResponse()

    if (!request.attachment || !request.attachment.dataBuffer) {
      response.success = false
      response.message = "Error: could not retrieve data from attachment, or attachment does not exist"
      winston.error(`Failed execute for sendgrid. ${response.message}`)
      return response
    }

    if (!request.formParams.to) {
      response.success = false
      response.message = "Error: invalid email address"
      winston.error(`Failed execute for sendgrid. ${response.message}`)
      return response
    }

    const filename = request.formParams.filename || request.suggestedFilename()
    const plan = request.scheduledPlan
    const subject = request.formParams.subject || (plan && plan.title ? plan.title : "Looker")
    const from = request.formParams.from ? request.formParams.from : "Looker <noreply@lookermail.com>"

    const msg = new helpers.classes.Mail({
      to: request.formParams.to,
      subject,
      from,
      text: plan && plan.url ?
          `View this data in Looker. ${plan.url}\n Results are attached.`
        :
          "Results are attached.",
      html: plan && plan.url ?
          `<p><a href="${plan.url}">View this data in Looker.</a></p><p>Results are attached.</p>`
        :
          "Results are attached.",
      attachments: [{
        content: request.attachment.dataBuffer.toString(request.attachment.encoding),
        filename,
      }],
    })
    try {
      await this.sendEmail(request, msg)
      response.success = true
    } catch (e: any) {
      response.success = false
      response.message = `Error: ${e.message}`

      if (e.response) {
        winston.error(`Failed execute for sendgrid with status code: ${e.response.status}`)
      }
    }
    return response
  }

  async sendEmail(request: Hub.ActionRequest, msg: helpers.classes.Mail) {
    const client = this.sgMailClientFromRequest(request)
    return await client.send(msg)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      name: "to",
      label: "To Email Address",
      description: "e.g. test@example.com",
      type: "string",
      required: true,
    }, {
      name: "from",
      label: "From Email Address",
      description: "e.g. test@example.com",
      type: "string",
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }, {
      label: "Subject",
      name: "subject",
      type: "string",
    }]
    return form
  }

  private sgMailClientFromRequest(request: Hub.ActionRequest) {
    sendgridMail.setApiKey(request.params.sendgrid_api_key!)
    return sendgridMail
  }

}

Hub.addAction(new SendGridAction())
