import * as Hub from "../../hub"
import { CustomerIoAction, CustomerIoCalls, CustomerIoTags } from "./customerio"

export class CustoomerIoGroupAction extends CustomerIoAction {

  tag = CustomerIoTags.CustomerIoGroupId

  name = "segment_group"
  label = "Segment Group"
  iconName = "segment/segment.png"
  description = "Add traits and / or users to your Segment groups."
  requiredFields = [{ tag: this.tag , any_tag: this.allowedTags}]
  minimumSupportedLookerVersion = "5.5.0"

  async execute(request: Hub.ActionRequest) {
    return this.executeCustomerIo(request, CustomerIoCalls.Group)
  }

}

Hub.addAction(new CustoomerIoGroupAction())
