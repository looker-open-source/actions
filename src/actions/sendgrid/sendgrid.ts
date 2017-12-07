import * as Hub from "../../hub"

const sendgridMail = require("@sendgrid/mail")

interface SendGridEmail {
  to: string
  subject: string
  from: string
  text: string
  html: string
  attachments: {content: string, filename: string}[]
}

export class SendGridAction extends Hub.Action {

  constructor() {
    super()

    this.name = "sendgrid"
    this.label = "SendGrid"
    this.iconName = "sendgrid/sendgrid.png"
    this.description = "Send data files to an email via SendGrid."
    this.params = [
      {
        description: "API key for SendGrid from https://app.sendgrid.com/settings/api_keys.",
        label: "SendGrid API Key",
        name: "sendgrid_api_key",
        required: true,
        sensitive: true,
      },
    ]
    this.supportedActionTypes = [Hub.ActionType.Query, Hub.ActionType.Dashboard]
  }

  async execute(request: Hub.ActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams || !request.formParams.to) {
      throw "Needs a valid email address."
    }
    const filename = request.formParams.filename || request.suggestedFilename() as string
    const subject = request.formParams.subject || request.scheduledPlan!.title!
    const from = request.formParams.from || "Looker <noreply@lookermail.com>"
    const msg: SendGridEmail = {
      to: request.formParams.to!,
      subject,
      from,
      text: `View this data in Looker. ${request.scheduledPlan!.url}\n Results are attached.`,
      html: `<p><a href="${request.scheduledPlan!.url}">View this data in Looker.</a></p><p>Results are attached.</p>`,
      attachments: [{
        content: request.attachment.dataBuffer.toString(request.attachment.encoding),
        filename,
      }],
    }
    const response = await this.sendEmail(request, msg)
    return new Hub.ActionResponse(response)
  }

  async sendEmail(request: Hub.ActionRequest, msg: SendGridEmail) {
    const client = this.sgMailClientFromRequest(request)
    let response
    try {
      await client.send(msg)
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return response
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
