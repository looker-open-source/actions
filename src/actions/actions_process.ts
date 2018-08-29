import * as semver from "semver"
import * as Hub from "../hub"
import {ActionRequest} from "../hub"
import "./index.ts"

async function execute(jsonPayload: any) {
    const req = JSON.parse(jsonPayload)
    const request = ActionRequest.fromJSON(req.body)
    request.instanceId = req.instanceId
    request.webhookId = req.webhookId
    const userAgent = req.userAgent
    if (userAgent) {
        const version = userAgent.split("LookerOutgoingWebhook/")[1]
        req.lookerVersion = semver.valid(version)
    }
    const action = await Hub.findAction(req.actionId, {lookerVersion: req.lookerVersion})
    return action.validateAndExecute(request)
}

process.on("message", (req) => {
    const response = execute(req)
    response.then((val) => { process.send!(val)})
        .catch((err) => { process.send!(err)})
})
