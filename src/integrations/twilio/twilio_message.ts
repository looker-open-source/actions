import * as D from "../../framework"

import * as twilio from "twilio"

const TWILIO_MAX_MESSAGE_BODY = 1600
const TAG = "phone"

export class TwilioMessageIntegration extends D.Integration {

  constructor() {
    super()

    this.name = "twilio_message"
    this.label = "Twilio"
    this.iconName = "twilio/twilio.svg"
    this.description = "Send a message to phone numbers through Twilio."
    this.supportedActionTypes = ["cell", "query"]
    this.supportedFormats = ["csv", "txt"]
    this.requiredFields = [{tag: TAG}]
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

  async action(request: D.ActionRequest) {

    if (!request.formParams || !request.formParams.message) {
      throw "Need a message."
    }

    const body = D.truncateString(request.formParams.message!, TWILIO_MAX_MESSAGE_BODY)

    let phoneNumbers: string[] = []
    switch (request.type) {
      case "query":
        if (!(request.attachment && request.attachment.dataJSON)) {
          throw "Couldn't get data from attachment."
        }

        const qr = request.attachment.dataJSON
        if (!qr.fields || !qr.data) {
          throw "Request payload is an invalid format."
        }
        const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
        const identifiableFields = fields.filter((f: any) =>
          f.tags && f.tags.some((t: string) => t === TAG),
        )
        if (identifiableFields.length === 0) {
          throw `Query requires a field tagged ${TAG}.`
        }
        phoneNumbers = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
        break
      case "cell":
        const value = request.params.value
        if (!value) {
          throw "Couldn't get data from cell."
        }
        phoneNumbers = [value]
        break
    }

    const client = this.twilioClientFromRequest(request)

    let response
    try {
      await Promise.all(phoneNumbers.map(async (to) => {
        const message = {
          from: request.params.from,
          to,
          body,
        }
        return client.messages.create(message)
      }))
    } catch (e) {
      response = {success: false, message: e.message}
    }

    return new D.ActionResponse(response)
  }

  async form() {
    const form = new D.ActionForm()
    form.fields = [{
      label: "Message",
      name: "message",
      required: true,
      type: "textarea",
    }]
    return form
  }

  private twilioClientFromRequest(request: D.ActionRequest) {
    return twilio(request.params.accountSid, request.params.authToken)
  }

}

D.addIntegration(new TwilioMessageIntegration())
