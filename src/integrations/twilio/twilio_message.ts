import * as D from "../../framework"

const twilio = require("twilio")

const TWILIO_MAX_MESSAGE_BODY = 1600

export class TwilioMessageIntegration extends D.Integration {

  tag = "phone"

  constructor() {
    super()

    this.name = "twilio_message"
    this.label = "Twilio"
    this.iconName = "twilio.svg"
    this.description = "Send a message to phone numbers through Twilio."
    this.supportedActionTypes = ["cell", "query"]
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

      if (!request.formParams || !request.formParams.message) {
        reject("Need a message.")
        return
      }

      const body = D.truncateString(request.formParams.message, TWILIO_MAX_MESSAGE_BODY)

      let phoneNumbers: string[] = []
      switch (request.type) {
        case "query":
          if (!(request.attachment && request.attachment.dataJSON)) {
            reject("Couldn't get data from attachment.")
            return
          }

          const qr = request.attachment.dataJSON
          if (!qr.fields || !qr.data) {
            reject("Request payload is an invalid format.")
            return
          }
          const fields: any[] = [].concat(...Object.keys(qr.fields).map((k) => qr.fields[k]))
          const identifiableFields = fields.filter((f: any) =>
            f.tags && f.tags.some((t: string) => t === this.tag),
          )
          if (identifiableFields.length === 0) {
            reject(`Query requires a field tagged ${this.tag}.`)
            return
          }
          phoneNumbers = qr.data.map((row: any) => (row[identifiableFields[0].name].value))
          break
        case "cell":
          if (!request.params.value) {
            reject("Couldn't get data from attachment.")
            return
          }
          phoneNumbers = [request.params.value]
          break
      }

      const client = this.twilioClientFromRequest(request)

      phoneNumbers.map((to: string) => {
        client.messages.create({
          from: request.params.from,
          to,
          body,
        }).then(() => {
          resolve(new D.DataActionResponse())
        }).catch((err: any) => {
          reject(err)
        })
      })
    })
  }

  async form() {
    const form = new D.DataActionForm()
    form.fields = [{
      label: "Message",
      name: "message",
      required: true,
      type: "textarea",
    }]
    return form
  }

  private twilioClientFromRequest(request: D.DataActionRequest) {
    return new twilio(request.params.accountSid, request.params.authToken)
  }

}

D.addIntegration(new TwilioMessageIntegration())
