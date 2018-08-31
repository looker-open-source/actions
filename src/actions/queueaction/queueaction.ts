
import * as Hub from "../../hub"

export class Queueaction extends Hub.Action {
    name = "queue_action"
    label = "Test Queue"
    description = "Used to test process queue in unit tests"
    params = []
    supportedActionTypes = [Hub.ActionType.Query]
    runInOwnProcess = true

    async execute(request: Hub.ActionRequest) {
        const result = JSON.parse(JSON.stringify(request.attachment!.dataBuffer))
        return new Hub.ActionResponse(result)
    }
}
