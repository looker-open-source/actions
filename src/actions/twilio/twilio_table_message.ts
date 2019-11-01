import * as Hub from "../../hub"

import * as twilio from "twilio"
import * as winston from "winston"

const TWILIO_MAX_MESSAGE_BODY = 1600
const TAGS = ["phone", "message"]

export class TwilioCustomMessageAction extends Hub.Action {

  name = "twilio_message_table"
  label = "Twilio - Send Message in table"
  iconName = "twilio/twilio.svg"
  description = "Send a message to phone numbers via Twilio."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetail]
  requiredFields = [{ all_tags: TAGS }]
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
      name: "MessageSID",
      label: "Twilio Verified SID",
      required: true,
      sensitive: false,
      description: "A valid Twilio message SID",
    },
  ]

  async execute(request: Hub.ActionRequest) {

    if (!(request.attachment && request.attachment.dataJSON)) {
      throw "Couldn't get data from attachment."
    }

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }
    const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
    const phoneField = fields.filter((f: any) =>
      f.tags && f.tags.some((t: string) => t === TAGS[0]),
    )
    const messageField = fields.filter((f: any) =>
      f.tags && f.tags.some((t: string) => t === TAGS[1]),
    )
    if (phoneField.length === 0 || messageField.length === 0) {
      throw `Query requires a field tagged ${TAGS}.`
    }

    const sendValues = qr.data.map((row: any) => ([row[phoneField[0].name].value, row[messageField[0].name].html]))

    const client = this.twilioClientFromRequest(request)

    let response
    try {
      await Promise.all(sendValues.map(async (to: any) => {
        const messageBody = Hub.truncateString(to[1], TWILIO_MAX_MESSAGE_BODY)
        const message = {
          messagingServiceSid: request.params.MessageSID,
          to: to[0],
          body: messageBody,
        }
        return client.messages.create(message)
      }))
    } catch (e) {
      winston.error(JSON.stringify(e))
      response = {success: false, message: e.message}
    }

    return new Hub.ActionResponse(response)
  }

  private twilioClientFromRequest(request: Hub.ActionRequest) {
    return twilio(request.params.accountSid, request.params.authToken)
  }

}

Hub.addAction(new TwilioCustomMessageAction())
