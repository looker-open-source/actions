import * as chai from "chai"
import * as Hub from "../../hub"

import {ExecuteProcessQueue} from "../../../lib/server/action_process_queue"
import {Queueaction} from "./queueaction"

const action = new Queueaction()
const queue = new ExecuteProcessQueue()

describe(`${action.constructor.name} unit tests for ProcessQueue`, () => {
    describe("action", () => {
        it("returns success on successful response", () => {
            const request = new Hub.ActionRequest()
            request.type = Hub.ActionType.Query
            request.attachment = {dataBuffer: Buffer.from(JSON.stringify({ success: true }))}
            chai.expect(action.validateAndExecute(request, queue)).to.be.fulfilled
                .then((response: Hub.ActionResponse) => {
                    chai.assert(response.success === true, "Response was not a success")
            })
        })
    })
})
