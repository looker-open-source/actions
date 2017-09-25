import * as D from "../../framework"

const twilio = require("twilio")

const MAX_LINES = 10
const TWILIO_MAX_MESSAGE_BODY = 1600

export class TwilioIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "twilio"
    this.label = "Twilio"
    this.iconName = "twilio.svg"
    this.description = "Send data to an phone number through Twilio."
    this.supportedActionTypes = ["query"]
    this.supportedFormats = ["csv", "txt"]
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
        label: "Twilio Verified Phone # Caller Id",
        required: true,
        sensitive: false,
        description: "A valid Twilio number from www.twilio.com/console/phone-numbers/verified.",
      },
    ]
  }

  async action(request: D.DataActionRequest) {
    return new Promise<D.DataActionResponse>((resolve, reject) => {
      if (!request.attachment || !request.attachment.dataBuffer) {
        throw "Couldn't get data from attachment."
      }

      if (!request.formParams || !request.formParams.to) {
        throw "Need a destination phone number."
      }

      const body = request.suggestedTruncatedMessage(MAX_LINES, TWILIO_MAX_MESSAGE_BODY)
      const client = this.twilioClientFromRequest(request)

      client.messages.create({
        from: request.params.from,
        to: request.formParams.to,
        body,
      }).then(() => {
        resolve(new D.DataActionResponse())
      }).catch((err: any) => {
        reject(err)
      })
    })
  }

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      label: "Dest. Phone #",
      name: "to",
      required: true,
      type: "string",
    }]
    return form
  }

  private twilioClientFromRequest(request: D.DataActionRequest) {
    return new twilio(request.params.accountSid, request.params.authToken)
  }

}

D.addIntegration(new TwilioIntegration())
