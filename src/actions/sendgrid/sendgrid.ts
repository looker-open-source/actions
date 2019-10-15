import * as Hub from "../../hub"

import { MailData } from "@sendgrid/helpers/classes/mail"

import * as sendgridClient from "@sendgrid/client"
import * as sendgridMail from "@sendgrid/mail"

export class SendGridAction extends Hub.Action {

  name = "sendgrid"
  label = "SendGrid"
  iconName = "sendgrid/sendgrid.png"
  description = "Send data files to an email via SendGrid."
  params = [
    {
      description: "API key for SendGrid from https://app.sendgrid.com/settings/api_keys.",
      label: "API Key",
      name: "sendgrid_api_key",
      required: true,
      sensitive: true,
    },
    {
      description: " SendGrid Dynamic Template Id from https://sendgrid.com/dynamic_templates.",
      label: "Template Id",
      name: "template",
      required: false,
      sensitive: false,
    },
  ]
  supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]

  async execute(request: Hub.ActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams.to) {
      throw "Needs a valid email address."
    }
    const filename = request.formParams.filename || request.suggestedFilename() as string
    const plan = request.scheduledPlan
    const subject = request.formParams.subject || (plan && plan.title ? plan.title : "Looker")
    const from = request.formParams.from ? request.formParams.from : "Looker <noreply@lookermail.com>"

    const msg: MailData = {
      from,
      attachments: [{
        content: request.attachment.dataBuffer.toString(request.attachment.encoding),
        filename,
      }],
    }
    const personalization: any = {
      to: request.formParams.to,
      subject,
    }
    if (request.params.template) {
      msg.templateId = request.params.template
      const templateData: { [key: string]: string } = {
        subject,
        to: request.formParams.to,
        from,
      }
      if (plan && plan.url) {
        templateData.url = plan.url
      }
      personalization.dynamic_template_data = templateData
    } else {
      let text
      let html
      if (plan && plan.url) {
        text = `View this data in Looker. ${plan.url}\n Results are attached.`
        html = `<p><a href="${plan.url}">View this data in Looker.</a></p><p>Results are attached.</p>`
      } else {
        text = `Results are attached.`
        html = `<p>Results are attached.</p>`
      }
      msg.text = text
      msg.html = html
    }
    msg.personalizations = [personalization]

    let response
    try {
      await this.sendEmail(request, msg)
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new Hub.ActionResponse(response)
  }

  async sendEmail(request: Hub.ActionRequest, msg: MailData) {
    const client = this.sgMailClientFromRequest(request)
    return await client.send(msg)
  }

  async getTemplate(request: Hub.ActionRequest) {
    const client = this.sgClientFromRequest(request)
    const req = {
      method: "GET",
      url: `/v3/templates/${request.params.template}`,
    }

    const [response] = await client.request(req)
    return response.body
  }

  async form(request: Hub.ActionRequest) {
    const form = new Hub.ActionForm()
    if (request.params.template) {
      const errorMessage = "Template not found"
      try {
        const template = await this.getTemplate(request)
        if (!(template.id === request.params.template)) {
          form.error = errorMessage
          return form
        }
      } catch (e) {
        if (e.message === "NOT FOUND") {
          form.error = errorMessage
        } else {
          form.error = e.message
        }
        return form
      }
    }
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

  private sgClientFromRequest(request: Hub.ActionRequest) {
    sendgridClient.setApiKey(request.params.sendgrid_api_key!)
    return sendgridClient
  }

  private sgMailClientFromRequest(request: Hub.ActionRequest) {
    sendgridMail.setApiKey(request.params.sendgrid_api_key!)
    return sendgridMail
  }

}

Hub.addAction(new SendGridAction())
