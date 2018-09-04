import * as chai from "chai"
import * as Hub from "../../hub"

import * as winston from "winston"
import {ExecuteProcessQueue} from "../../../lib/server/action_process_queue"
import {QueueAction} from "./queueaction"

const action = new QueueAction()
const queue = new ExecuteProcessQueue()
process.execArgv = ["./node_modules/ts-node/dist/bin.js"]
process.argv = ["node", "./integrations/src/boot.ts"]
process.env.CHILD_TEST = "true"

describe(`${action.constructor.name} unit tests for ProcessQueue`, () => {
    describe("action", () => {
        it("returns success on successful response", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.attachment = {dataBuffer: Buffer.from(JSON.stringify({ success: true }))}
            return action.validateAndExecute(request, queue).then((response: Hub.ActionResponse) => {
                chai.expect(response.success).to.equal(true)
            })
        }).timeout(10000)

        it("returns failure on failed response", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.attachment = {dataBuffer: Buffer.from(JSON.stringify({ success: false }))}
            return action.validateAndExecute(request, queue).then((response: Hub.ActionResponse) => {
                winston.info("Response: " + JSON.stringify(response))
                chai.expect(response.success).to.equal(false)
            })
        }).timeout(10000)
    })
})
