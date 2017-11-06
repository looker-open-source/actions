import * as D from "../../framework"

import {WebhookIntegration} from "../webhook/webhook"

export class ZapierIntegration extends WebhookIntegration {

  constructor() {
    super()
    this.name = "zapier"
    this.label = "Zapier"
    this.iconName = "zapier/zapier.png"
    this.description = "Send data and begin a Zapier workflow."
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

D.addIntegration(new ZapierIntegration())
