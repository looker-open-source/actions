"use strict";
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
    async execute(request) {
        return this.executeSegment(request, segment_1.SegmentCalls.Group);
    }
}
exports.SegmentGroupAction = SegmentGroupAction;
Hub.addAction(new SegmentGroupAction());
