import * as D from "../../framework"

import * as twilio from "twilio"

const MAX_LINES = 10
const TWILIO_MAX_MESSAGE_BODY = 1600

export class TwilioAction extends D.Action {

  constructor() {
    super()

    this.name = "twilio"
    this.label = "Twilio - Send Data"
    this.iconName = "twilio/twilio.svg"
    this.description = "Send data from a Look to a phone number via Twilio."
    this.supportedActionTypes = [D.ActionType.Query]
    this.supportedFormats = [D.ActionFormat.Csv, D.ActionFormat.Txt]
    this.requiredFields = []
    this.params = [
      {
        name: "accountSid",
        label: "Account SID",
        required: true,
        sensitive: false,
        description: "Account SID from www.twilio.com/console.",
      }, {
        name: "authToken",
        label: "Auth Token",
        required: true,
        sensitive: true,
        description: "Auth Token from www.twilio.com/console.",
      }, {
        name: "from",
        label: "Twilio Verified Phone Number",
        required: true,
        sensitive: false,
        description: "A valid Twilio number from www.twilio.com/console/phone-numbers/verified.",
      },
    ]
  }

  async action(request: D.ActionRequest) {
    if (!request.attachment || !request.attachment.dataBuffer) {
      throw "Couldn't get data from attachment."
    }

    if (!request.formParams || !request.formParams.to) {
      throw "Need a destination phone number."
    }

    const body = request.suggestedTruncatedMessage(MAX_LINES, TWILIO_MAX_MESSAGE_BODY)
    const client = this.twilioClientFromRequest(request)
    const message = {
      from: request.params.from,
      to: request.formParams.to,
      body,
    }

    let response
    try {
      await client.messages.create(message)
    } catch (e) {
      response = {success: false, message: e.message}
    }
    return new D.ActionResponse(response)
  }

  async form() {
    const form = new D.ActionForm()
    form.fields = [{
      label: "Destination Phone Number",
      name: "to",
      required: true,
      type: "string",
    }]
    return form
  }

  private twilioClientFromRequest(request: D.ActionRequest) {
    return twilio(request.params.accountSid, request.params.authToken)
  }

}

D.addAction(new TwilioAction())
