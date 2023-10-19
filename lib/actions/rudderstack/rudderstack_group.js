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
exports.RudderGroupAction = void 0;
const Hub = require("../../hub");
const rudderstack_1 = require("./rudderstack");
class RudderGroupAction extends rudderstack_1.RudderAction {
    constructor() {
        super(...arguments);
        this.tag = rudderstack_1.RudderTags.RudderGroupId;
        this.name = "rudder_group";
        this.label = "Rudder Group";
        this.description = "Add traits and / or users to your Rudder groups.";
        this.requiredFields = [{ tag: this.tag, any_tag: this.allowedTags }];
        this.minimumSupportedLookerVersion = "5.5.0";
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeRudder(request, rudderstack_1.RudderCalls.Group);
        });
    }
}
exports.RudderGroupAction = RudderGroupAction;
Hub.addAction(new RudderGroupAction());
