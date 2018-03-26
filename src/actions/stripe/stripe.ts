import * as Hub from "../../hub"

import * as stripe from "stripe"

const TAG = "stripe_charge_id"

export class StripeRefundAction extends Hub.Action {

    name = "stripe_refund_charge"
    label = "Stripe - Refund Charge"
    iconName = "amazon/amazon_ec2.png"
    description = "Refund a Stripe charge."
    params = [
        {
            name: "secret_key",
            label: "Secret Key",
            required: true,
            sensitive: true,
            description: "Your secret key for Stripe.",
        },
    ]
    supportedActionTypes = [Hub.ActionType.Cell]
    supportedFormats = [Hub.ActionFormat.JsonDetail]
    requiredFields = [{ tag: TAG }]

    async execute(request: Hub.ActionRequest) {
        let stripe_client: stripe
        if (!request.params.value) {
            throw "Couldn't find secret key."
        }
        stripe_client = new stripe(request.params.secret_key!)

        let charge_id: string
        if (!request.params.value) {
            throw "Couldn't get data from cell."
        }
        charge_id = request.params.value
        const params = {charge: charge_id}

        let response
        try {
            await stripe_client.refunds.create(params)
        } catch (e) {
            response = {success: false, message: e.message}
        }
        return new Hub.ActionResponse(response)
    }
}

Hub.addAction(new StripeRefundAction())
