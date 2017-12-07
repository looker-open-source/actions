import * as D from "../../framework"

import {WebhookAction} from "../webhook/webhook"

export class ZapierAction extends WebhookAction {

  constructor() {
    super()
    this.name = "zapier"
    this.label = "Zapier"
    this.iconName = "zapier/zapier.png"
    this.description = "Send data and begin a Zapier zap."
    this.domain = "zapier.com"
  }

  async form() {
    const form = new D.ActionForm()
    form.fields = [{
      label: "Zapier Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}

D.addAction(new ZapierAction())
