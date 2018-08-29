import * as Hub from "../hub"
import {ActionRequest} from "../hub"
import "./index.ts"

async function execute(jsonPayload: any) {
    const req = JSON.parse(jsonPayload)
    const request = ActionRequest.fromIPC(req)
    const action = await Hub.findAction(req.actionId, {lookerVersion: req.lookerVersion})
    return action.execute(request)
}

process.on("message", (req) => {
    const response = execute(req)
    response.then((val) => { process.send!(val)})
        .catch((err) => { process.send!(err)})
})
