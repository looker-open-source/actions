import "../actions/index.ts"
import * as Hub from "../hub/index"

async function execute(jsonPayload: any) {
    const req = JSON.parse(jsonPayload)
    const request = Hub.ActionRequest.fromIPC(req)
    const action = await Hub.findAction(req.actionId, {lookerVersion: req.lookerVersion})
    return action.execute(request)
}

process.on("message", (req) => {
    const response = execute(req)
    response.then((val) => { process.send!(val)})
        .catch((err) => { process.send!({success: false, message: JSON.stringify(err)})})
})
