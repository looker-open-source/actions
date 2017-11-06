import * as D from "../../framework"

import {WebhookIntegration} from "../webhook/webhook"

export class TrayIntegration extends WebhookIntegration {

  constructor() {
    super()
    this.name = "tray"
    this.label = "Tray"
    this.iconName = "tray/tray.svg"
    this.description = "Send data and begin a Tray workflow."
    this.domain = "trayapp.io"
  }

  async form() {
    const form = new D.ActionForm()
    form.fields = [{
      label: "Tray Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}

D.addIntegration(new TrayIntegration())
