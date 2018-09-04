import * as chai from "chai"
import * as Hub from "../../hub"

import {ExecuteProcessQueue} from "../../xpc/execute_process_queue"
import {QueueTestAction} from "./queue_action_for_testing"

const action = new QueueTestAction()
const queue = new ExecuteProcessQueue()
process.execArgv = ["./node_modules/ts-node/dist/bin.js"]
process.argv = ["node", "./integrations/src/boot.ts"]
process.env.CHILD_TEST = "true"

function expectResponse(
    request: Hub.ActionRequest,
    success: boolean,
) {
    const execute = action.validateAndExecute(request, queue).then((response: Hub.ActionResponse) => {
        chai.expect(response.success).to.equal(success)
    })
    return chai.expect(execute).to.be.fulfilled
}

describe(`${action.constructor.name} unit tests for ProcessQueue`, () => {
    describe("action", () => {
        it("returns success on successful response", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.attachment = {dataBuffer: Buffer.from(JSON.stringify({ success: true }))}
            return expectResponse(request, true)
        }).timeout(30000)

        it("returns failure on failed response", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.attachment = {dataBuffer: Buffer.from(JSON.stringify({ success: false }))}
            return expectResponse(request, false)
        }).timeout(30000)
    })
})
