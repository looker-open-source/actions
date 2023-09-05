"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionForm = void 0;
class ActionForm {
    constructor() {
        this.fields = [];
    }
    asJson() {
        if (this.error) {
            return { error: typeof this.error === "string" ? this.error : this.error.message };
        }
        return {
            fields: this.fields,
            state: this.state,
        };
    }
}
exports.ActionForm = ActionForm;
