import * as D from "../framework"

import SGMail = require("@sendgrid/mail")

export interface ISendGridEmail {
  to: string
  subject: string
  from: string
  html: string
  attachments: {content: string, filename: string}[]
}

export class SendGridIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "sendgrid"
    this.label = "SendGrid"
    this.iconName = "sendgrid.png"
    this.description = "Send files to an email address via SendGrid."
    this.params = [
      {
        description: "API key for SendGrid from https://app.sendgrid.com/settings/api_keys.",
        label: "SendGrid API Key",
        name: "sendgrid_api_key",
        required: true,
        sensitive: true,
      },
    ]
    this.supportedActionTypes = ["query", "dashboard"]
  }

  async action(request: D.DataActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams || !request.formParams.email) {
      throw "Needs a valid email address."
    }
    const fileName = request.formParams.filename || request.suggestedFilename() as string
    const msg: ISendGridEmail = {
      to: request.formParams.email!,
      subject: request.scheduledPlan!.title!,
      from: "Looker <noreply@lookermail.com>",
      html: `<p><a href="${request.scheduledPlan!.url}">View this data in Looker</a></p><p>Results are attached</p>`,
      attachments: [{
        content: request.attachment.dataBuffer.toString(request.attachment.encoding),
        filename: fileName,
      }],
    }
    const response = await this.sendEmail(request, msg)
    return new D.DataActionResponse(response)
  }

  async sendEmail(request: D.DataActionRequest, msg: ISendGridEmail) {
    const client = this.sgMailClientFromRequest(request)
    let response
    try {
      await client.send(msg)
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return response
  }

  async form(request: D.DataActionRequest) {
    const form = new D.DataActionForm()
    form.fields = [{
      name: "email",
      label: "Email Address",
      description: "e.g. test@example.com",
      type: "string",
      required: true,
      default: request.type,
    }, {
      label: "Filename",
      name: "filename",
      type: "string",
    }]
    return form
  }

  private sgMailClientFromRequest(request: D.DataActionRequest) {
    SGMail.setApiKey(request.params.sendgrid_api_key!)
    return SGMail
  }

}

D.addIntegration(new SendGridIntegration())
