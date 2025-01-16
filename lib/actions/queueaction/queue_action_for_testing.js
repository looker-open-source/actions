"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueTestAction = void 0;
const Hub = require("../../hub");
class QueueTestAction extends Hub.Action {
    constructor() {
        super(...arguments);
        this.name = "queue_action";
        this.label = "Test Queue";
        this.description = "Used to test process queue in unit tests";
        this.params = [];
        this.supportedActionTypes = [Hub.ActionType.Query];
        this.executeInOwnProcess = true;
    }
    async execute(request) {
        try {
            const result = JSON.parse(request.attachment.dataBuffer.toString());
            return new Hub.ActionResponse({ success: result.success });
        }
        catch (e) {
            return new Hub.ActionResponse({ success: false, message: "Nope" });
        }
    }
}
exports.QueueTestAction = QueueTestAction;
if (process.env.CHILD_TEST) {
    Hub.addAction(new QueueTestAction());
}
