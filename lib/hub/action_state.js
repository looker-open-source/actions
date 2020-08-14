"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionState = void 0;
class ActionState {
    asJson() {
        return { data: this.data, refresh_time: this.refreshTime };
    }
}
exports.ActionState = ActionState;
