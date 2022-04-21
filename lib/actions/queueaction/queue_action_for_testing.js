"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = JSON.parse(request.attachment.dataBuffer.toString());
                return new Hub.ActionResponse({ success: result.success });
            }
            catch (e) {
                return new Hub.ActionResponse({ success: false, message: "Nope" });
            }
        });
    }
}
exports.QueueTestAction = QueueTestAction;
if (process.env.CHILD_TEST) {
    Hub.addAction(new QueueTestAction());
}
