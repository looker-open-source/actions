import * as D from "../framework"

import {WebhookIntegration} from "./webhook"

export class ZapierIntegration extends WebhookIntegration {

  constructor() {
    super()
    this.name = "zapier"
    this.label = "Zapier"
    this.iconName = "zapier.png"
    this.description = "Takes a data attachment and begins a Zapier workflow"
  }

  async form() {
    const form = new D.DataActionForm()
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
