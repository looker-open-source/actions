import * as Hub from "../../hub"

import {WebhookAction} from "../webhook/webhook"

export class ZapierAction extends WebhookAction {

  name = "zapier"
  label = "Zapier"
  iconName = "zapier/zapier.png"
  description = "Send data and begin a Zapier zap."

  domain = "zapier.com"

  async form() {
    const form = new Hub.ActionForm()
    form.fields = [{
      label: "Zapier Webhook URL",
      name: "url",
      required: true,
      type: "string",
    }]
    return form
  }
}

Hub.addAction(new ZapierAction())
