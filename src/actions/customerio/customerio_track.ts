import * as Hub from "../../hub"
import {CustomerIoAction, CustomerIoCalls} from "./customerio"

export class CustomerIoTrackAction extends CustomerIoAction {

    name = "customerio_track"
    label = "Customer.io Track"
    iconName = "customerio/customerio.png"
    description = "Add traits via track to your customer.io users."
    minimumSupportedLookerVersion = "5.5.0"

    async execute(request: Hub.ActionRequest) {
        return this.executeCustomerIo(request, CustomerIoCalls.Track)
    }

    async form() {
        const form = new Hub.ActionForm()
        form.fields = [
            {
                name: "event",
                label: "Event",
                description: "The name of the event you’re tracking.",
                type: "string",
                required: true,
            },
            {
                description: "Override default api key",
                label: "Override API Key",
                name: "override_customer_io_api_key",
                required: false,
            }, {
                description: "Override default site id",
                label: "Override Site ID",
                name: "override_customer_io_site_id",
                required: false,
            },
        ]
        return form
    }

}

Hub.addAction(new CustomerIoTrackAction())
