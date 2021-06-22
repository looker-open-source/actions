import * as Hub from "../../hub"

import * as twilio from "twilio"

const TWILIO_MAX_MESSAGE_BODY = 1600
const TAG = "phone"

export class TwilioMessageAction extends Hub.Action {

  name = "twilio_message"
  label = "Twilio - Send Message"
  iconName = "twilio/twilio.svg"
  description = "Send a message to phone numbers via Twilio."
  supportedActionTypes = [Hub.ActionType.Cell, Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  requiredFields = [{ tag: TAG }]
  params = [
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
      label: "Twilio Phone Number",
      required: true,
      sensitive: false,
      description: "A valid Twilio number from https://www.twilio.com/console",
    },
  ]

  async execute(request: Hub.ActionRequest) {

    if (!request.formParams.message) {
      throw "Need a message."
    }

    const body = Hub.truncateString(request.formParams.message, TWILIO_MAX_MESSAGE_BODY)

    let phoneNumbers: string[] = []
    switch (request.type) {
      case Hub.ActionType.Query:
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
      case Hub.ActionType.Cell:
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

    return new Hub.ActionResponse(response)
  }

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Message",
      name: "message",
      required: true,
      type: "textarea",
    }]
    return form
  }

  private twilioClientFromRequest(request: Hub.ActionRequest) {
    return twilio(request.params.accountSid, request.params.authToken)
  }

}

Hub.addAction(new TwilioMessageAction())
