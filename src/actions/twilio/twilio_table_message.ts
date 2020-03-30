import * as Hub from "../../hub"

import * as twilio from "twilio"
import * as winston from "winston"
import {Field} from "../../hub"

const TWILIO_MAX_MESSAGE_BODY = 1600
const TAGS = ["phone", "message"]

export class TwilioCustomMessageAction extends Hub.Action {

  name = "twilio_message_table"
  label = "Twilio - Send Message in table"
  iconName = "twilio/twilio.svg"
  description = "Send a message to phone numbers via Twilio."
  supportedActionTypes = [Hub.ActionType.Query]
  supportedFormats = [Hub.ActionFormat.JsonDetailLiteStream]
  requiredFields = [{ all_tags: TAGS }]
  usesStreaming = true
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
      throw "No data from attachment."
    }

    const qr = request.attachment.dataJSON
    if (!qr.fields || !qr.data) {
      throw "Request payload is an invalid format."
    }
    let phoneField: Field[]
    let messageField: Field[]
    const sendData: string[][] = []
    const errors: string[] = []
    const client = this.twilioClientFromRequest(request)

    await request.streamJsonDetail({
      onFields: (fields) => {
        const fieldset = Hub.allFields(fields)
        phoneField = fieldset.filter((f: any) =>
          f.tags && f.tags.some((t: string) => t === TAGS[0]),
        )
        messageField = fieldset.filter((f: any) =>
          f.tags && f.tags.some((t: string) => t === TAGS[1]),
        )
        if (phoneField.length === 0 || messageField.length === 0) {
          throw `Query requires a field tagged ${TAGS}.`
        }
      },
      onRow: (row) => {
        sendData.push([row[phoneField[0].name].value, row[messageField[0].name].html])
        if (sendData.length >= 500) {
          this.flush(client, sendData, request).then((errs: string[]) => {
            errs.map((err) => { errors.push(err) })
          }).catch((e: any) => {
            errors.push(e)
          })
        }
      }
    })

    await this.flush(client, sendData, request).then((errs: string[]) => {
      errs.map((err) => { errors.push(err) })
    }).catch((e: any) => {
      errors.push(e)
    })

    const errorsMessage = (errors.length === 0) ? "" : JSON.stringify(errors)
    const response = {success: (errors.length === 0), message: errorsMessage}

    return new Hub.ActionResponse(response)
  }

  async flush(client: any, data: string[][], request: Hub.ActionRequest) {
    const errors: string[] = []
    try {
      await Promise.all(data.map(async (to: any) => {
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
      errors.push(e.message)
    }
    return errors
  }

  private twilioClientFromRequest(request: Hub.ActionRequest) {
    return twilio(request.params.accountSid, request.params.authToken)
  }

}

Hub.addAction(new TwilioCustomMessageAction())
