import * as Hub from "../../hub"

export class QueueTestAction extends Hub.Action {
    name = "queue_action"
    label = "Test Queue"
    description = "Used to test process queue in unit tests"
    params = []
    supportedActionTypes = [Hub.ActionType.Query]
    executeInOwnProcess = true

    async execute(request: Hub.ActionRequest) {
        try {
            const result = JSON.parse(request.attachment!.dataBuffer!.toString())
            return new Hub.ActionResponse({success: result.success})
        } catch (e) {
            return new Hub.ActionResponse({success: false, message: "Nope"})
        }
    }
}

if (process.env.CHILD_TEST) {
    Hub.addAction(new QueueTestAction())
}
