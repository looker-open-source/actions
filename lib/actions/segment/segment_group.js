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
exports.SegmentGroupAction = void 0;
const Hub = require("../../hub");
const segment_1 = require("./segment");
class SegmentGroupAction extends segment_1.SegmentAction {
    constructor() {
        super(...arguments);
        this.tag = segment_1.SegmentTags.SegmentGroupId;
        this.name = "segment_group";
        this.label = "Segment Group";
        this.iconName = "segment/segment.png";
        this.description = "Add traits and / or users to your Segment groups.";
        this.requiredFields = [{ tag: this.tag, any_tag: this.allowedTags }];
        this.minimumSupportedLookerVersion = "5.5.0";
    }
    execute(request) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.executeSegment(request, segment_1.SegmentCalls.Group);
        });
    }
}
exports.SegmentGroupAction = SegmentGroupAction;
Hub.addAction(new SegmentGroupAction());
