import * as D from "../../framework"

import {WebhookAction} from "../webhook/webhook"

export class TrayAction extends WebhookAction {

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

D.addAction(new TrayAction())
