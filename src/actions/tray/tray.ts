import * as Hub from "../../hub"

import {WebhookAction} from "../webhook/webhook"

export class TrayAction extends WebhookAction {

  name = "tray"
  label = "Tray"
  iconName = "tray/tray.svg"
  description = "Send data and begin a Tray workflow."
  domain = "trayapp.io"

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Tray Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }

}

Hub.addAction(new TrayAction())
